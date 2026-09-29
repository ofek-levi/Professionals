/**
 * Service request validation: the REST payload (`POST /requests`, `PATCH /requests/:id`) and the
 * customer's request form.
 */
import { z } from 'zod';

import { APP_CONFIG } from '@/constants/app-config';
import { isSupportedCategoryId } from '@/constants/professional-categories';
import { isPreferredDateWithinUrgency } from '@/features/offers/offer-rules';
import { URGENCY_LEVELS } from '@/constants/urgency-levels';
import type { CreateServiceRequestPayload, UpdateDraftRequestPayload } from '@/types/api';
import {
  PREFERRED_TIME_WINDOWS,
  type CategoryId,
  type GeoCoordinates,
  type ISODateString,
  type PreferredTimeWindow,
  type ServiceRequest,
  type UrgencyLevel,
} from '@/types/domain';
import { daysBetweenDateKeys, isValidDateKey, toDateKey, type DateInput } from '@/utils/dates';

import {
  categoryIdSchema,
  coordinatesSchema,
  dateKeySchema,
  LOCATION_LIMITS,
  nullableText,
  optionalText,
  requiredText,
  serviceLocationInputSchema,
} from './common';
import { vm, type ValidationMessageKey } from './messages';

const descriptionSchema = requiredText({
  min: APP_CONFIG.descriptionMinLength,
  max: APP_CONFIG.descriptionMaxLength,
  required: vm('request.descriptionRequired'),
  tooShort: vm('request.descriptionTooShort'),
  tooLong: vm('request.descriptionTooLong'),
});

const urgencySchema = z.enum(URGENCY_LEVELS, { error: vm('request.urgencyRequired') });
const timeWindowSchema = z.enum(PREFERRED_TIME_WINDOWS, { error: vm('request.timeWindowInvalid') });

/**
 * Preferred date rule shared by the form and the server: a valid date key, not before today and
 * at most `APP_CONFIG.maxScheduleDaysAhead` days ahead. Returns an i18n key or `null`.
 */
function validatePreferredDate(dateKey: string, now: DateInput): ValidationMessageKey | null {
  if (!isValidDateKey(dateKey)) return vm('request.preferredDateInvalid');
  const days = daysBetweenDateKeys(toDateKey(now), dateKey);
  if (days < 0) return vm('request.preferredDateInPast');
  if (days > APP_CONFIG.maxScheduleDaysAhead) return vm('request.preferredDateTooFar');
  return null;
}

/**
 * `validatePreferredDate` plus the urgency window: an emergency or urgent request can't ask for a
 * date no offer is allowed to use. Returns an i18n key or `null`.
 */
export function validatePreferredDateForUrgency(dateKey: string, urgency: UrgencyLevel, now: DateInput): ValidationMessageKey | null {
  const issue = validatePreferredDate(dateKey, now);
  if (issue) return issue;
  return isPreferredDateWithinUrgency(urgency, dateKey, now) ? null : vm('request.preferredDateBeyondUrgency');
}

const preferredScheduleSchema = z.object({
  date: dateKeySchema(vm('request.preferredDateInvalid')),
  timeWindow: timeWindowSchema,
});

const photoIdsSchema = z
  .array(z.string().trim().min(1, vm('request.photoInvalid')))
  .max(APP_CONFIG.maxRequestPhotos, vm('request.tooManyPhotos'));

const requestPayloadShape = {
  categoryId: categoryIdSchema,
  description: descriptionSchema,
  location: serviceLocationInputSchema,
  urgency: urgencySchema,
  preferredSchedule: preferredScheduleSchema.nullable(),
  photoIds: photoIdsSchema,
  notes: nullableText(APP_CONFIG.notesMaxLength, vm('request.notesTooLong')),
};

/**
 * `POST /requests` payload. Structural rules only; time-relative rules (preferred date not in the
 * past, within the urgency window) are checked with `validatePreferredDateForUrgency` against the
 * server clock.
 */
export const createServiceRequestSchema = z.object({
  ...requestPayloadShape,
  photoIds: photoIdsSchema.default([]),
  notes: requestPayloadShape.notes.default(null),
  preferredSchedule: requestPayloadShape.preferredSchedule.default(null),
  publish: z.boolean().default(true),
});

/** `PATCH /requests/:id` (drafts only) – every field optional, no defaults. */
export const updateDraftRequestSchema = z.object(requestPayloadShape).partial();

// ────────────────────────────── Request form ──────────────────────────────

export const requestFormLocationSchema = z.object({
  coordinates: coordinatesSchema,
  addressLine: requiredText({
    max: LOCATION_LIMITS.addressLineMax,
    required: vm('location.addressRequired'),
    tooLong: vm('location.addressTooLong'),
  }),
  city: requiredText({ max: LOCATION_LIMITS.cityMax, required: vm('location.cityRequired'), tooLong: vm('invalid') }),
  neighborhood: z.string().trim().max(LOCATION_LIMITS.neighborhoodMax, vm('invalid')).nullable(),
  details: z.string().trim().max(LOCATION_LIMITS.detailsMax, vm('location.detailsTooLong')).nullable(),
});

/** A photo picked on the device (not uploaded yet unless `uploadId` is set). */
export const requestFormPhotoSchema = z.object({
  uri: z.string().min(1, vm('request.photoInvalid')),
  width: z.number(),
  height: z.number(),
  mimeType: z.string().nullable(),
  fileName: z.string().nullable(),
  /** Id returned by `POST /uploads/images` (photos of an edited draft are already uploaded). */
  uploadId: z.string().nullable().optional(),
});

/**
 * Builds the form schema. `getNow` is evaluated at validation time so a long-open form still
 * rejects dates that became past.
 */
export function createRequestFormSchema(getNow: () => Date = () => new Date()) {
  const schema = z.object({
    categoryId: z.string().nullable().superRefine((value, ctx) => {
      if (value === null || value === '') ctx.addIssue({ code: 'custom', message: vm('category.required') });
      else if (!isSupportedCategoryId(value)) ctx.addIssue({ code: 'custom', message: vm('category.unsupported') });
    }),
    description: descriptionSchema,
    location: requestFormLocationSchema.nullable().superRefine((value, ctx) => {
      if (value === null) ctx.addIssue({ code: 'custom', message: vm('location.required') });
    }),
    urgency: z
      .enum(URGENCY_LEVELS)
      .nullable()
      .superRefine((value, ctx) => {
        if (value === null) ctx.addIssue({ code: 'custom', message: vm('request.urgencyRequired') });
      }),
    preferredDate: z
      .string()
      .nullable()
      .superRefine((value, ctx) => {
        if (value === null || value === '') return;
        const issue = validatePreferredDate(value, getNow());
        if (issue) ctx.addIssue({ code: 'custom', message: issue });
      }),
    preferredTimeWindow: timeWindowSchema,
    notes: optionalText(APP_CONFIG.notesMaxLength, vm('request.notesTooLong')),
    photos: z.array(requestFormPhotoSchema).max(APP_CONFIG.maxRequestPhotos, vm('request.tooManyPhotos')),
  });
  // The preferred date must also fit the urgency (checked on the date field).
  return schema.superRefine((values, ctx) => {
    if (!values.preferredDate || !values.urgency) return;
    if (validatePreferredDate(values.preferredDate, getNow())) return; // reported by the field itself
    if (!isPreferredDateWithinUrgency(values.urgency, values.preferredDate, getNow())) {
      ctx.addIssue({ code: 'custom', path: ['preferredDate'], message: vm('request.preferredDateBeyondUrgency') });
    }
  });
}

export const requestFormSchema = createRequestFormSchema();

export type RequestFormValues = z.input<typeof requestFormSchema>;
export type RequestFormLocation = z.input<typeof requestFormLocationSchema>;
export type RequestFormPhoto = z.input<typeof requestFormPhotoSchema>;

/** Initial form values (optionally with a preselected category or default location). */
export function createEmptyRequestFormValues(
  options: { categoryId?: CategoryId | null; location?: RequestFormLocation | null } = {},
): RequestFormValues {
  return {
    categoryId: options.categoryId ?? null,
    description: '',
    location: options.location ?? null,
    urgency: null,
    preferredDate: null,
    preferredTimeWindow: 'any',
    notes: '',
    photos: [],
  };
}

/** Prefills the form from an existing (draft) request. */
export function requestToFormValues(request: ServiceRequest): RequestFormValues {
  return {
    categoryId: request.categoryId,
    description: request.description,
    location: {
      coordinates: { ...request.location.coordinates },
      addressLine: request.location.addressLine,
      city: request.location.city,
      neighborhood: request.location.neighborhood,
      details: request.location.details,
    },
    urgency: request.urgency,
    preferredDate: request.preferredSchedule?.date ?? null,
    preferredTimeWindow: request.preferredSchedule?.timeWindow ?? 'any',
    notes: request.notes ?? '',
    photos: request.photos.map((photo) => ({
      uri: photo.url,
      width: photo.width ?? 0,
      height: photo.height ?? 0,
      mimeType: null,
      fileName: null,
      uploadId: photo.id,
    })),
  };
}

function requireValue<T>(value: T | null | undefined, field: string): T {
  if (value === null || value === undefined) {
    throw new Error(`Request form field "${field}" is missing – validate the form before building the payload`);
  }
  return value;
}

type RequestPayloadFields = Omit<CreateServiceRequestPayload, 'publish'>;

function toRequestPayloadFields(values: RequestFormValues, photoIds: readonly string[]): RequestPayloadFields {
  const categoryId = requireValue(values.categoryId, 'categoryId');
  if (!isSupportedCategoryId(categoryId)) throw new Error(`Unsupported category "${categoryId}"`);
  const location = requireValue(values.location, 'location');
  const urgency: UrgencyLevel = requireValue(values.urgency, 'urgency');
  const coordinates: GeoCoordinates = { latitude: location.coordinates.latitude, longitude: location.coordinates.longitude };
  const preferredDate: ISODateString | null = values.preferredDate ? values.preferredDate : null;
  const timeWindow: PreferredTimeWindow = values.preferredTimeWindow;
  const notes = values.notes.trim();
  return {
    categoryId,
    description: values.description.trim(),
    location: {
      coordinates,
      addressLine: location.addressLine.trim(),
      city: location.city.trim(),
      neighborhood: location.neighborhood?.trim() || null,
      details: location.details?.trim() || null,
    },
    urgency,
    preferredSchedule: preferredDate ? { date: preferredDate, timeWindow } : null,
    photoIds: [...photoIds],
    notes: notes.length > 0 ? notes : null,
  };
}

/** Converts validated form values into the `POST /requests` payload. */
export function toCreateRequestPayload(
  values: RequestFormValues,
  photoIds: readonly string[],
  publish: boolean,
): CreateServiceRequestPayload {
  return { ...toRequestPayloadFields(values, photoIds), publish };
}

/** Converts validated form values into the `PATCH /requests/:id` payload (draft editing). */
export function toUpdateDraftRequestPayload(values: RequestFormValues, photoIds: readonly string[]): UpdateDraftRequestPayload {
  return toRequestPayloadFields(values, photoIds);
}
