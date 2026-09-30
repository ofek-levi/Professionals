/**
 * Payloads and queries of the request routes, ported from the app (`lib/validation/request.ts`,
 * `cancel.ts`, the mock's explorer params). Time-relative rules (preferred date vs today and the
 * urgency) run in the services against the server clock.
 */
import { z } from 'zod';

import { paginationQueryShape } from '../../lib/pagination.js';
import { queryBoolean, queryEnum, queryEnumList, queryNumber, queryString } from '../../lib/query-schemas.js';
import { CATEGORY_IDS } from '../../shared/catalog/index.js';
import {
  NEARBY_REQUEST_SORTS,
  OFFER_PRESENCE_FILTERS,
  PREFERRED_TIME_WINDOWS,
  REQUEST_CANCELLATION_REASONS,
} from '../../shared/domain.js';
import { APP_CONFIG } from '../../shared/limits.js';
import { CUSTOMER_REQUEST_SECTIONS, REQUEST_STATUSES } from '../../shared/statuses.js';
import { URGENCY_LEVELS } from '../../shared/urgency.js';
import { vm } from '../../shared/validation-messages.js';
import { categoryIdSchema, nullableText, serviceLocationInputSchema } from '../auth/auth-fields.schemas.js';
import { isValidDateKey } from './market-calendar.js';

/** Max length of the free-text cancellation comment (the app's `CANCEL_COMMENT_MAX_LENGTH`). */
const CANCEL_COMMENT_MAX_LENGTH = 300;

export const requestParams = z.object({ requestId: z.string() });

const descriptionSchema = z
  .string({ error: vm('request.descriptionRequired') })
  .trim()
  .superRefine((value, ctx) => {
    if (value.length === 0) ctx.addIssue({ code: 'custom', message: vm('request.descriptionRequired') });
    else if (value.length < APP_CONFIG.descriptionMinLength) ctx.addIssue({ code: 'custom', message: vm('request.descriptionTooShort') });
    else if (value.length > APP_CONFIG.descriptionMaxLength) ctx.addIssue({ code: 'custom', message: vm('request.descriptionTooLong') });
  });

const preferredScheduleSchema = z.object({
  date: z.string({ error: vm('request.preferredDateInvalid') }).refine(isValidDateKey, { message: vm('request.preferredDateInvalid') }),
  timeWindow: z.enum(PREFERRED_TIME_WINDOWS, { error: vm('request.timeWindowInvalid') }),
});

const requestFields = {
  categoryId: categoryIdSchema,
  description: descriptionSchema,
  location: serviceLocationInputSchema,
  urgency: z.enum(URGENCY_LEVELS, { error: vm('request.urgencyRequired') }),
  preferredSchedule: preferredScheduleSchema.nullable(),
  notes: nullableText(APP_CONFIG.notesMaxLength, vm('request.notesTooLong')),
};

/**
 * `POST /requests` (multipart: this is the JSON field `data`, the photos are the files `photos`;
 * `publish: false` saves a draft). `clientRequestId` (optional) makes it idempotent: a retry with
 * the same id returns the request the first attempt created, without storing its photos again.
 */
export const createRequestBody = z.object({
  ...requestFields,
  notes: requestFields.notes.default(null),
  preferredSchedule: requestFields.preferredSchedule.default(null),
  publish: z.boolean({ error: vm('invalid') }).default(true),
  clientRequestId: z.string({ error: vm('invalid') }).trim().min(1, vm('invalid')).max(100, vm('invalid')).optional(),
});
export type CreateRequestInput = z.output<typeof createRequestBody>;

/**
 * `PATCH /requests/:id` (drafts only; multipart like `POST /requests`): every field optional.
 * `keepPhotos`: public ids of the current photos to keep, in order (omitted = all); the new files
 * `photos` are added after them. Listing every kept photo makes a retried edit safe.
 */
export const updateDraftRequestBody = z
  .object({
    ...requestFields,
    keepPhotos: z.array(z.string({ error: vm('request.photoNotFound') })).max(APP_CONFIG.maxRequestPhotos, vm('request.tooManyPhotos')),
  })
  .partial();
export type UpdateDraftRequestInput = z.output<typeof updateDraftRequestBody>;

/** `POST /requests/:id/cancel` */
export const cancelRequestBody = z.object({
  reason: z.enum(REQUEST_CANCELLATION_REASONS, { error: vm('cancel.reasonRequired') }),
  comment: z
    .string()
    .trim()
    .max(CANCEL_COMMENT_MAX_LENGTH, vm('cancel.commentTooLong'))
    .nullable()
    .optional()
    .transform((value) => (value ? value : null)),
});
export type CancelRequestInput = z.output<typeof cancelRequestBody>;

/** `GET /customer/requests` */
export const customerRequestsQuery = z.object({
  ...paginationQueryShape,
  section: queryEnum(CUSTOMER_REQUEST_SECTIONS),
  statuses: queryEnumList(REQUEST_STATUSES),
});
export type CustomerRequestsQuery = z.output<typeof customerRequestsQuery>;

const dateKeyQuery = queryString(10).refine((value) => value === undefined || isValidDateKey(value), vm('invalid'));

/** `GET /professional/requests/nearby` (the explorer filters of the app). */
export const nearbyRequestsQuery = z.object({
  ...paginationQueryShape,
  categoryIds: queryEnumList(CATEGORY_IDS),
  // Only the app's presets: with any float, the answer ("inside or not") could be used to measure
  // distances finely by moving one's own service area.
  maxDistanceKm: queryNumber().refine(
    (value) => value === undefined || (APP_CONFIG.distanceFilterOptionsKm as readonly number[]).includes(value),
    vm('invalid'),
  ),
  urgencies: queryEnumList(URGENCY_LEVELS),
  preferredDateFrom: dateKeyQuery,
  preferredDateTo: dateKeyQuery,
  offerPresence: queryEnum(OFFER_PRESENCE_FILTERS),
  excludeWithMyOffer: queryBoolean(),
  sort: queryEnum(NEARBY_REQUEST_SORTS),
});
export type NearbyRequestsQuery = z.output<typeof nearbyRequestsQuery>;
