/**
 * Offer payloads and queries (the app's `lib/validation/offer.ts`). Time rules against the request
 * (`offer-rules.ts`) run in the services on the server clock.
 */
import { z } from 'zod';

import { paginationQueryShape } from '../../lib/pagination.js';
import { queryEnum, queryEnumList } from '../../lib/query-schemas.js';
import { OFFER_SORTS, SUPPORTED_CURRENCIES } from '../../shared/domain.js';
import { APP_CONFIG } from '../../shared/limits.js';
import { OFFER_STATUSES } from '../../shared/statuses.js';
import { vm, type ValidationMessage } from '../../shared/validation-messages.js';
import { nullableText } from '../auth/auth-fields.schemas.js';

/** Estimated duration bounds in minutes (15 minutes – 7 days). */
const DURATION_BOUNDS = { min: 15, max: 7 * 24 * 60 } as const;

export const offerParams = z.object({ offerId: z.string() });
export const requestOffersParams = z.object({ requestId: z.string() });

function priceIssue(value: number): ValidationMessage | null {
  if (!Number.isFinite(value) || value <= 0) return vm('offer.priceInvalid');
  if (value < APP_CONFIG.minOfferPrice) return vm('offer.priceTooLow');
  if (value > APP_CONFIG.maxOfferPrice) return vm('offer.priceTooHigh');
  if (Math.abs(Math.round(value * 100) - value * 100) >= 1e-6) return vm('offer.priceDecimals');
  return null;
}

const priceSchema = z.number({ error: vm('offer.priceInvalid') }).superRefine((value, ctx) => {
  const issue = priceIssue(value);
  if (issue) ctx.addIssue({ code: 'custom', message: issue });
});

/** An ISO-8601 instant (the app's `isValidDateTimeString`), parsed to a `Date`. */
const proposedStartSchema = z
  .string({ error: vm('offer.startInvalid') })
  .refine((value) => value.length >= 10 && !Number.isNaN(Date.parse(value)), { message: vm('offer.startInvalid') })
  .transform((value) => new Date(value));

const durationSchema = z
  .number({ error: vm('offer.durationInvalid') })
  .int(vm('offer.durationInvalid'))
  .min(DURATION_BOUNDS.min, vm('offer.durationInvalid'))
  .max(DURATION_BOUNDS.max, vm('offer.durationInvalid'));

/** `POST /requests/:id/offers` */
export const createOfferBody = z.object({
  price: priceSchema,
  currency: z.enum(SUPPORTED_CURRENCIES, { error: vm('offer.currencyUnsupported') }),
  proposedStartAt: proposedStartSchema,
  estimatedDurationMinutes: durationSchema.nullable(),
  message: nullableText(APP_CONFIG.offerMessageMaxLength, vm('offer.messageTooLong')),
});
export type CreateOfferInput = z.output<typeof createOfferBody>;

/** `PATCH /offers/:id` (pending offers only) */
export const updateOfferBody = createOfferBody.partial();
export type UpdateOfferInput = z.output<typeof updateOfferBody>;

/** `GET /requests/:id/offers` */
export const requestOffersQuery = z.object({
  ...paginationQueryShape,
  sort: queryEnum(OFFER_SORTS),
  statuses: queryEnumList(OFFER_STATUSES),
});
export type RequestOffersQuery = z.output<typeof requestOffersQuery>;

/** `GET /professional/offers` */
export const professionalOffersQuery = z.object({ ...paginationQueryShape, statuses: queryEnumList(OFFER_STATUSES) });
export type ProfessionalOffersQuery = z.output<typeof professionalOffersQuery>;
