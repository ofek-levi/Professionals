/**
 * Business rules for the proposed appointment time of an offer.
 *
 * Errors block submission (the mock backend rejects them with 422 on `proposedStartAt`);
 * warnings are advisory and only shown in the offer form.
 */
import { APP_CONFIG } from '@/constants/app-config';
import { isWithinWorkingHours } from '@/features/profiles/availability';
import { vm, type ValidationMessageKey } from '@/lib/validation/messages';
import type { ServiceRequest, WeeklyAvailability } from '@/types/domain';
import { isWithinTimeWindow, parseDateKey, toDate, toDateKey, type DateInput } from '@/utils/dates';

export const OFFER_TIME_RULES = {
  /** A proposed start must be at least this far in the future. */
  minLeadMinutes: 30,
  maxDaysAhead: APP_CONFIG.maxScheduleDaysAhead,
  /** Emergency requests must be handled within this many hours. */
  emergencyMaxHours: 24,
  /** Urgent requests must be handled within this many hours. */
  urgentMaxHours: 72,
} as const;

export type OfferRuleCode =
  | 'start_invalid'
  | 'start_too_soon'
  | 'start_too_far'
  | 'emergency_window'
  | 'urgent_window'
  | 'different_from_preferred_date'
  | 'outside_preferred_time_window'
  | 'outside_working_hours';

export interface OfferRuleIssue {
  code: OfferRuleCode;
  severity: 'error' | 'warning';
  /** i18n key in the `validation` namespace. */
  message: ValidationMessageKey;
}

export interface OfferRuleResult {
  isValid: boolean;
  errors: OfferRuleIssue[];
  warnings: OfferRuleIssue[];
}

export interface OfferRuleInput {
  proposedStartAt: DateInput;
  request: Pick<ServiceRequest, 'urgency' | 'preferredSchedule'>;
  now: DateInput;
  /** The professional's working hours; enables the "outside working hours" warning. */
  availability?: WeeklyAvailability | null;
  estimatedDurationMinutes?: number | null;
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
 * handled within 24 h, an urgent job within 72 h). Shared by the request wizard and the server.
 */
export function isPreferredDateWithinUrgency(urgency: ServiceRequest['urgency'], dateKey: string, now: DateInput): boolean {
  const day = parseDateKey(dateKey);
  return day !== null && day.getTime() <= latestAllowedOfferStart(urgency, now).getTime();
}

/** Earliest allowed start (now + minimum lead time). */
export function earliestAllowedOfferStart(now: DateInput): Date {
  return new Date(toDate(now).getTime() + OFFER_TIME_RULES.minLeadMinutes * MINUTE_MS);
}

/** Validates a proposed appointment start against the request and the professional's schedule. */
export function validateOfferAgainstRequest(input: OfferRuleInput): OfferRuleResult {
  const errors: OfferRuleIssue[] = [];
  const warnings: OfferRuleIssue[] = [];
  const error = (code: OfferRuleCode, message: ValidationMessageKey) => errors.push({ code, severity: 'error', message });
  const warn = (code: OfferRuleCode, message: ValidationMessageKey) => warnings.push({ code, severity: 'warning', message });

  const start = toDate(input.proposedStartAt);
  if (Number.isNaN(start.getTime())) {
    error('start_invalid', vm('offer.startInvalid'));
    return { isValid: false, errors, warnings };
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

  const preferred = input.request.preferredSchedule;
  if (preferred) {
    if (toDateKey(start) !== preferred.date) {
      warn('different_from_preferred_date', vm('offer.differentFromPreferredDate'));
    } else if (!isWithinTimeWindow(start, preferred.timeWindow)) {
      warn('outside_preferred_time_window', vm('offer.outsidePreferredTimeWindow'));
    }
  }
  if (input.availability && !isWithinWorkingHours(input.availability, start, input.estimatedDurationMinutes ?? 0)) {
    warn('outside_working_hours', vm('offer.outsideWorkingHours'));
  }

  return { isValid: errors.length === 0, errors, warnings };
}
