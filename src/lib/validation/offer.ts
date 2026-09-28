/**
 * Offer validation: the REST payload (`POST /requests/:id/offers`, `PATCH /offers/:id`) and the
 * professional's offer form (price typed as text, separate date and time pickers).
 */
import { z } from 'zod';

import { APP_CONFIG } from '@/constants/app-config';
import { validateOfferAgainstRequest, type OfferRuleCode } from '@/features/offers/offer-rules';
import type { CreateOfferPayload, UpdateOfferPayload } from '@/types/api';
import type { CurrencyCode, Offer, ServiceRequest } from '@/types/domain';
import { isValidDateKey, isValidTimeOfDay, splitDateTime, tryCombineDateAndTime } from '@/utils/dates';

import { currencySchema, isoDateTimeSchema, nullableText, optionalText, parseAmountInput, priceIssue, priceSchema } from './common';
import { vm } from './messages';

/** Estimated duration bounds in minutes (15 minutes – 7 days). */
const OFFER_DURATION_BOUNDS = { min: 15, max: 7 * 24 * 60 } as const;

const durationSchema = z
  .number({ error: vm('offer.durationInvalid') })
  .int(vm('offer.durationInvalid'))
  .min(OFFER_DURATION_BOUNDS.min, vm('offer.durationInvalid'))
  .max(OFFER_DURATION_BOUNDS.max, vm('offer.durationInvalid'));

/** `POST /requests/:id/offers` payload (structural; time rules come from `validateOfferAgainstRequest`). */
export const createOfferSchema = z.object({
  price: priceSchema,
  currency: currencySchema,
  proposedStartAt: isoDateTimeSchema(vm('offer.startInvalid')),
  estimatedDurationMinutes: durationSchema.nullable(),
  message: nullableText(APP_CONFIG.offerMessageMaxLength, vm('offer.messageTooLong')),
});

/** `PATCH /offers/:id` payload. */
export const updateOfferSchema = createOfferSchema.partial();

// ────────────────────────────── Offer form ──────────────────────────────

interface OfferFormContext {
  /** The request being quoted – enables urgency window rules (emergency ≤ 24h, urgent ≤ 72h). */
  request?: Pick<ServiceRequest, 'urgency'> | null;
}

/** Which form field shows each blocking time rule. */
const RULE_FIELD: Partial<Record<OfferRuleCode, 'date' | 'time'>> = {
  start_invalid: 'time',
  start_too_soon: 'time',
  start_too_far: 'date',
  emergency_window: 'date',
  urgent_window: 'date',
};

/**
 * Offer form schema. `now` may be a function so the "at least 30 minutes from now" rule is
 * evaluated at submit time. The time rules (`validateOfferAgainstRequest`) are reported on
 * `date`/`time`.
 */
export function createOfferFormSchema(now: Date | (() => Date), context: OfferFormContext = {}) {
  const getNow = typeof now === 'function' ? now : () => now;
  return z
    .object({
      price: z.string().superRefine((value, ctx) => {
        if (value.trim().length === 0) {
          ctx.addIssue({ code: 'custom', message: vm('offer.priceRequired') });
          return;
        }
        const amount = parseAmountInput(value);
        const issue = amount === null ? vm('offer.priceInvalid') : priceIssue(amount);
        if (issue) ctx.addIssue({ code: 'custom', message: issue });
      }),
      date: z.string().superRefine((value, ctx) => {
        if (value.length === 0) ctx.addIssue({ code: 'custom', message: vm('offer.dateRequired') });
        else if (!isValidDateKey(value)) ctx.addIssue({ code: 'custom', message: vm('offer.dateInvalid') });
      }),
      time: z.string().superRefine((value, ctx) => {
        if (value.length === 0) ctx.addIssue({ code: 'custom', message: vm('offer.timeRequired') });
        else if (!isValidTimeOfDay(value)) ctx.addIssue({ code: 'custom', message: vm('offer.timeInvalid') });
      }),
      estimatedDurationMinutes: durationSchema.nullable(),
      message: optionalText(APP_CONFIG.offerMessageMaxLength, vm('offer.messageTooLong')),
    })
    .superRefine(
      (values, ctx) => {
        // Runs even when other fields are invalid, so date/time problems show up immediately.
        const startAt = typeof values.date === 'string' && typeof values.time === 'string'
          ? tryCombineDateAndTime(values.date, values.time)
          : null;
        if (!startAt) return;
        const result = validateOfferAgainstRequest({
          proposedStartAt: startAt,
          request: context.request ?? { urgency: 'flexible' },
          now: getNow(),
        });
        for (const issue of result.errors) {
          ctx.addIssue({ code: 'custom', message: issue.message, path: [RULE_FIELD[issue.code] ?? 'date'] });
        }
      },
      { when: () => true },
    );
}

export type OfferFormValues = z.input<ReturnType<typeof createOfferFormSchema>>;

/** Empty form, optionally prefilled with a suggested start. */
export function createEmptyOfferFormValues(suggestedStart?: Date | null): OfferFormValues {
  const split = suggestedStart ? splitDateTime(suggestedStart) : null;
  return {
    price: '',
    date: split?.date ?? '',
    time: split?.time ?? '',
    estimatedDurationMinutes: null,
    message: '',
  };
}

/** Prefills the form when editing a pending offer. */
export function offerToFormValues(offer: Pick<Offer, 'price' | 'proposedStartAt' | 'estimatedDurationMinutes' | 'message'>): OfferFormValues {
  const { date, time } = splitDateTime(offer.proposedStartAt);
  return {
    price: String(offer.price),
    date,
    time,
    estimatedDurationMinutes: offer.estimatedDurationMinutes,
    message: offer.message ?? '',
  };
}

/** Converts validated form values into the create/update offer payload. */
export function toCreateOfferPayload(
  values: OfferFormValues,
  currency: CurrencyCode = APP_CONFIG.defaultCurrency,
): CreateOfferPayload {
  const price = parseAmountInput(values.price);
  const proposedStartAt = tryCombineDateAndTime(values.date, values.time);
  if (price === null || proposedStartAt === null) {
    throw new Error('Offer form is invalid – validate it before building the payload');
  }
  const message = values.message.trim();
  return {
    price,
    currency,
    proposedStartAt,
    estimatedDurationMinutes: values.estimatedDurationMinutes,
    message: message.length > 0 ? message : null,
  };
}

/** `PATCH /offers/:id` payload from the edit form (all fields are sent). */
export function toUpdateOfferPayload(values: OfferFormValues, currency?: CurrencyCode): UpdateOfferPayload {
  return toCreateOfferPayload(values, currency);
}
