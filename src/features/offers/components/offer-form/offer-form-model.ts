/**
 * View-model helpers of the offer form: which dates/times can be picked for a request, a sensible
 * preselected appointment, message templates and the mapping of server errors onto form fields.
 * Pure (no React), deterministic given `now`.
 */
import { earliestAllowedOfferStart, latestAllowedOfferStart, OFFER_TIME_RULES } from '@/features/offers/offer-rules';
import { findNextWorkingSlot, getWorkingHoursForDate } from '@/features/profiles/availability';
import type { OfferFormValues } from '@/lib/validation';
import type { ApiErrorCode } from '@/types/api';
import type { ServiceRequest, TimeOfDayString, UrgencyLevel, WeeklyAvailability } from '@/types/domain';
import {
  addDays,
  daysBetweenDateKeys,
  minutesOfDay,
  parseDateKey,
  roundUpToMinutes,
  splitDateTime,
  startOfLocalDay,
  timeToMinutes,
  TIME_WINDOW_RANGES,
  toDate,
  toDateKey,
  type DateInput,
} from '@/utils/dates';

/** Time-slot granularity of the offer form. */
export const OFFER_SLOT_MINUTES = 30;
/** How many days the date picker offers at most. */
export const OFFER_DATE_PICKER_DAYS = 14;
/** Lead time used when *suggesting* a start (the hard rule is `OFFER_TIME_RULES.minLeadMinutes`). */
export const SUGGESTION_LEAD_MINUTES = 60;

export interface SlotRange {
  start: TimeOfDayString;
  /** Slots start strictly before this time. */
  end: TimeOfDayString;
}

/** Emergencies get early-morning and late-evening slots; everything else a regular day. */
export function offerTimeRange(urgency: UrgencyLevel): SlotRange {
  return urgency === 'emergency' ? { start: '06:00', end: '23:30' } : { start: '07:00', end: '21:00' };
}

/** Number of selectable days starting today, limited by the urgency window (emergency 24h, urgent 72h). */
export function offerDateDays(urgency: UrgencyLevel, now: DateInput, maxDays = OFFER_DATE_PICKER_DAYS): number {
  const latestKey = toDateKey(latestAllowedOfferStart(urgency, now));
  const span = daysBetweenDateKeys(toDateKey(now), latestKey) + 1;
  return Math.max(1, Math.min(maxDays, span));
}

/** Whether `date` + `time` is inside the slot grid of the picker. */
function isInsideSlotRange(date: Date, range: SlotRange): boolean {
  const minutes = minutesOfDay(date);
  return minutes >= timeToMinutes(range.start) && minutes < timeToMinutes(range.end) && minutes % OFFER_SLOT_MINUTES === 0;
}

/** Moves an instant into the slot grid: aligned to the slot size, same day if possible, else the next morning. */
export function clampIntoSlotRange(value: DateInput, range: SlotRange): Date {
  const aligned = roundUpToMinutes(value, OFFER_SLOT_MINUTES);
  const minutes = minutesOfDay(aligned);
  const first = timeToMinutes(range.start);
  const lastStart = timeToMinutes(range.end) - OFFER_SLOT_MINUTES;
  const day = startOfLocalDay(aligned);
  if (minutes < first) return new Date(day.getTime() + first * 60_000);
  if (minutes > lastStart) {
    const next = addDays(day, 1);
    return new Date(next.getTime() + first * 60_000);
  }
  return aligned;
}

export interface SuggestOfferStartInput {
  request: Pick<ServiceRequest, 'urgency' | 'preferredSchedule'>;
  availability?: WeeklyAvailability | null;
  now: DateInput;
}

/**
 * A sensible preselected appointment:
 * 1. the customer's preferred date and window (when it is still reachable), else
 * 2. the professional's next working slot from a target day that depends on the urgency
 *    (emergency: now, urgent: tomorrow, normal: in 2 days, flexible: in 3 days), else
 * 3. the earliest allowed slot.
 * Always inside the urgency window and the picker's slot grid; `null` when nothing fits.
 */
export function suggestOfferStart({ request, availability, now }: SuggestOfferStartInput): { date: string; time: string } | null {
  const nowDate = toDate(now);
  const range = offerTimeRange(request.urgency);
  const earliestRule = earliestAllowedOfferStart(nowDate).getTime();
  const earliest = clampIntoSlotRange(new Date(nowDate.getTime() + SUGGESTION_LEAD_MINUTES * 60_000), range);
  const latest = latestAllowedOfferStart(request.urgency, nowDate).getTime();
  const fits = (candidate: Date | null): candidate is Date =>
    candidate !== null &&
    candidate.getTime() >= earliestRule &&
    candidate.getTime() >= earliest.getTime() - 1 &&
    candidate.getTime() <= latest &&
    isInsideSlotRange(candidate, range);

  // 1. Preferred date + window.
  const preferred = request.preferredSchedule;
  const preferredDay = preferred ? parseDateKey(preferred.date) : null;
  if (preferred && preferredDay) {
    const hours = availability ? getWorkingHoursForDate(availability, preferredDay) : null;
    const windowStart =
      preferred.timeWindow === 'any' ? (hours?.start ?? '09:00') : TIME_WINDOW_RANGES[preferred.timeWindow].start;
    const windowEnd = preferred.timeWindow === 'any' ? (hours?.end ?? range.end) : TIME_WINDOW_RANGES[preferred.timeWindow].end;
    let candidate = new Date(preferredDay.getTime() + timeToMinutes(windowStart) * 60_000);
    if (candidate.getTime() < earliest.getTime()) candidate = earliest;
    const sameDay = toDateKey(candidate) === preferred.date;
    const insideWindow = minutesOfDay(candidate) < timeToMinutes(windowEnd);
    if (sameDay && insideWindow && fits(candidate)) return splitDateTime(candidate);
  }

  // 2. Next working slot from the urgency's target day.
  const offsetDays = { emergency: 0, urgent: 1, normal: 2, flexible: 3 }[request.urgency];
  const targetDay = offsetDays === 0 ? earliest : startOfLocalDay(addDays(nowDate, offsetDays));
  const from = targetDay.getTime() < earliest.getTime() ? earliest : targetDay;
  if (availability) {
    const slot = findNextWorkingSlot(availability, from, { slotMinutes: OFFER_SLOT_MINUTES, durationMinutes: 60, maxDays: 14 });
    if (fits(slot)) return splitDateTime(slot);
  }
  const fallback = offsetDays === 0 ? earliest : clampIntoSlotRange(new Date(from.getTime() + 9 * 60 * 60_000), range);
  if (fits(fallback)) return splitDateTime(fallback);

  // 3. Earliest allowed slot.
  return fits(earliest) ? splitDateTime(earliest) : null;
}

/** Appends a quick-template text to the message (new paragraph), never exceeding `maxLength`. */
export function appendTemplate(current: string, text: string, maxLength: number): string {
  const base = current.trimEnd();
  if (base.includes(text.trim())) return current;
  const next = base.length > 0 ? `${base}\n\n${text.trim()}` : text.trim();
  return next.slice(0, maxLength);
}

export type OfferFormField = keyof OfferFormValues;

/** Server `fieldErrors` paths → offer form fields (first message wins). */
export function mapOfferServerFieldErrors(fieldErrors: Record<string, string[]> | undefined): Partial<Record<OfferFormField, string>> {
  const result: Partial<Record<OfferFormField, string>> = {};
  if (!fieldErrors) return result;
  const target: Record<string, OfferFormField> = {
    price: 'price',
    currency: 'price',
    proposedStartAt: 'time',
    estimatedDurationMinutes: 'estimatedDurationMinutes',
    message: 'message',
  };
  for (const [path, messages] of Object.entries(fieldErrors)) {
    const field = target[path];
    if (field && messages[0] && !result[field]) result[field] = messages[0];
  }
  return result;
}

/** Business conflicts that are shown as a friendly banner (instead of a field error). */
export const OFFER_SUBMIT_PROBLEMS = [
  'DUPLICATE_OFFER',
  'REQUEST_NOT_ACCEPTING_OFFERS',
  'OUTSIDE_SERVICE_AREA',
  'OFFER_EXPIRED',
  'UNSUPPORTED_CATEGORY',
] as const satisfies readonly ApiErrorCode[];
export type OfferSubmitProblem = (typeof OFFER_SUBMIT_PROBLEMS)[number];

export function toOfferSubmitProblem(code: ApiErrorCode): OfferSubmitProblem | null {
  return (OFFER_SUBMIT_PROBLEMS as readonly ApiErrorCode[]).includes(code) ? (code as OfferSubmitProblem) : null;
}

/** Hours of the urgency window shown in the guidance text (`null` = only the global limit). */
export function urgencyWindowHours(urgency: UrgencyLevel): number | null {
  if (urgency === 'emergency') return OFFER_TIME_RULES.emergencyMaxHours;
  if (urgency === 'urgent') return OFFER_TIME_RULES.urgentMaxHours;
  return null;
}
