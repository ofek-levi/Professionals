/**
 * Business rules for the proposed appointment time of an offer. Violations block submission (the
 * offer form reports them on its date/time fields; the backend rejects them with 400
 * `VALIDATION_ERROR` on `proposedStartAt`).
 */
import { APP_CONFIG } from '@/constants/app-config';
import { vm, type ValidationMessageKey } from '@/lib/validation/messages';
import type { ServiceRequest } from '@/types/domain';
import { parseDateKey, toDate, type DateInput } from '@/utils/dates';

export const OFFER_TIME_RULES = {
  /** A proposed start must be at least this far in the future. */
  minLeadMinutes: 30,
  maxDaysAhead: APP_CONFIG.maxScheduleDaysAhead,
  /** Emergency requests must be handled within this many hours. */
  emergencyMaxHours: 24,
  /** Urgent requests must be handled within this many hours. */
  urgentMaxHours: 72,
} as const;

export type OfferRuleCode = 'start_invalid' | 'start_too_soon' | 'start_too_far' | 'emergency_window' | 'urgent_window';

interface OfferRuleIssue {
  code: OfferRuleCode;
  /** i18n key in the `validation` namespace. */
  message: ValidationMessageKey;
}

interface OfferRuleResult {
  isValid: boolean;
  errors: OfferRuleIssue[];
}

interface OfferRuleInput {
  proposedStartAt: DateInput;
  request: Pick<ServiceRequest, 'urgency'>;
  now: DateInput;
}

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Latest allowed start for an urgency level (the stricter of the urgency window and the global limit). */
export function latestAllowedOfferStart(urgency: ServiceRequest['urgency'], now: DateInput): Date {
  const nowMs = toDate(now).getTime();
  let latest = nowMs + OFFER_TIME_RULES.maxDaysAhead * DAY_MS;
  if (urgency === 'emergency') latest = Math.min(latest, nowMs + OFFER_TIME_RULES.emergencyMaxHours * HOUR_MS);
  if (urgency === 'urgent') latest = Math.min(latest, nowMs + OFFER_TIME_RULES.urgentMaxHours * HOUR_MS);
  return new Date(latest);
}

/**
 * Whether professionals can still propose a start on the preferred date (`YYYY-MM-DD`) of a request
 * with this urgency: the day must begin before the latest allowed start (an emergency must be
 * handled within 24 h, an urgent job within 72 h). Shared by the request form and the server.
 */
export function isPreferredDateWithinUrgency(urgency: ServiceRequest['urgency'], dateKey: string, now: DateInput): boolean {
  const day = parseDateKey(dateKey);
  return day !== null && day.getTime() <= latestAllowedOfferStart(urgency, now).getTime();
}

/** Earliest allowed start (now + minimum lead time). */
export function earliestAllowedOfferStart(now: DateInput): Date {
  return new Date(toDate(now).getTime() + OFFER_TIME_RULES.minLeadMinutes * MINUTE_MS);
}

/** Validates a proposed appointment start against the request's urgency and the global limits. */
export function validateOfferAgainstRequest(input: OfferRuleInput): OfferRuleResult {
  const errors: OfferRuleIssue[] = [];
  const error = (code: OfferRuleCode, message: ValidationMessageKey) => errors.push({ code, message });

  const start = toDate(input.proposedStartAt);
  if (Number.isNaN(start.getTime())) {
    error('start_invalid', vm('offer.startInvalid'));
    return { isValid: false, errors };
  }
  const nowMs = toDate(input.now).getTime();
  const startMs = start.getTime();

  if (startMs < earliestAllowedOfferStart(input.now).getTime()) {
    error('start_too_soon', vm('offer.startTooSoon'));
  } else if (startMs > nowMs + OFFER_TIME_RULES.maxDaysAhead * DAY_MS) {
    error('start_too_far', vm('offer.startTooFar'));
  } else if (input.request.urgency === 'emergency' && startMs > nowMs + OFFER_TIME_RULES.emergencyMaxHours * HOUR_MS) {
    error('emergency_window', vm('offer.emergencyWindow'));
  } else if (input.request.urgency === 'urgent' && startMs > nowMs + OFFER_TIME_RULES.urgentMaxHours * HOUR_MS) {
    error('urgent_window', vm('offer.urgentWindow'));
  }

  return { isValid: errors.length === 0, errors };
}
