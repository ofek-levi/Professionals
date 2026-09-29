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

const photoIdsSchema = z
  .array(z.string().trim().min(1, vm('request.photoInvalid')))
  .max(APP_CONFIG.maxRequestPhotos, vm('request.tooManyPhotos'));

const requestFields = {
  categoryId: categoryIdSchema,
  description: descriptionSchema,
  location: serviceLocationInputSchema,
  urgency: z.enum(URGENCY_LEVELS, { error: vm('request.urgencyRequired') }),
  preferredSchedule: preferredScheduleSchema.nullable(),
  photoIds: photoIdsSchema,
  notes: nullableText(APP_CONFIG.notesMaxLength, vm('request.notesTooLong')),
};

/** `POST /requests` (`publish: false` saves a draft). */
export const createRequestBody = z.object({
  ...requestFields,
  photoIds: photoIdsSchema.default([]),
  notes: requestFields.notes.default(null),
  preferredSchedule: requestFields.preferredSchedule.default(null),
  publish: z.boolean({ error: vm('invalid') }).default(true),
});
export type CreateRequestInput = z.output<typeof createRequestBody>;

/** `PATCH /requests/:id` (drafts only): every field optional. */
export const updateDraftRequestBody = z.object(requestFields).partial();
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
  maxDistanceKm: queryNumber().refine((value) => value === undefined || value > 0, vm('invalid')),
  urgencies: queryEnumList(URGENCY_LEVELS),
  preferredDateFrom: dateKeyQuery,
  preferredDateTo: dateKeyQuery,
  offerPresence: queryEnum(OFFER_PRESENCE_FILTERS),
  excludeWithMyOffer: queryBoolean(),
  sort: queryEnum(NEARBY_REQUEST_SORTS),
});
export type NearbyRequestsQuery = z.output<typeof nearbyRequestsQuery>;
