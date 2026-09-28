/**
 * View-model helpers of the offer form: which dates and times can be picked for a request, a
 * sensible preselected appointment and the mapping of server errors onto form fields.
 * Pure (no React), deterministic given `now`.
 */
import { earliestAllowedOfferStart, latestAllowedOfferStart, OFFER_TIME_RULES } from '@/features/offers/offer-rules';
import { getWorkingHoursForDate } from '@/features/profiles/availability';
import type { OfferFormValues } from '@/lib/validation';
import type { ApiErrorCode } from '@/types/api';
import type { ISODateString, ServiceRequest, TimeOfDayString, UrgencyLevel, WeeklyAvailability } from '@/types/domain';
import {
  addDays,
  daysBetweenDateKeys,
  minutesToTime,
  parseDateKey,
  startOfLocalDay,
  timeToMinutes,
  TIME_WINDOW_RANGES,
  toDate,
  toDateKey,
  type DateInput,
} from '@/utils/dates';

/** Time-slot granularity of the offer form. */
const OFFER_SLOT_MINUTES = 30;
/** How many days the date chips offer at most. */
const OFFER_DATE_PICKER_DAYS = 7;
/** Lead time used when *suggesting* a start (the hard rule is `OFFER_TIME_RULES.minLeadMinutes`). */
const SUGGESTION_LEAD_MINUTES = 60;

interface SlotRange {
  start: TimeOfDayString;
  /** Slots start strictly before this time. */
  end: TimeOfDayString;
}

/** Slots offered on days without working hours (day off, or no profile yet). */
const DEFAULT_OFFER_HOURS: SlotRange = { start: '07:00', end: '20:00' };

/** The professional's working hours on that day, or 07:00–20:00. */
export function offerSlotRange(availability: WeeklyAvailability | null | undefined, day: DateInput): SlotRange {
  return (availability ? getWorkingHoursForDate(availability, day) : null) ?? DEFAULT_OFFER_HOURS;
}

/** Number of selectable days starting today, limited by the urgency window (emergency 24h, urgent 72h). */
export function offerDateDays(urgency: UrgencyLevel, now: DateInput, maxDays = OFFER_DATE_PICKER_DAYS): number {
  const latestKey = toDateKey(latestAllowedOfferStart(urgency, now));
  const span = daysBetweenDateKeys(toDateKey(now), latestKey) + 1;
  return Math.max(1, Math.min(maxDays, span));
}

interface OfferTimeSlot {
  time: TimeOfDayString;
  /** Too soon (inside the minimum lead time) or beyond the urgency window. */
  disabled: boolean;
}

interface OfferSlotInput {
  urgency: UrgencyLevel;
  availability?: WeeklyAvailability | null;
  now: DateInput;
}

function slotStart(day: Date, minutes: number): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(minutes / 60), minutes % 60);
}

/** The 30-minute slots of a day (`YYYY-MM-DD`) inside its slot range, with the ones the offer rules reject disabled. */
export function offerTimeSlots({ date, urgency, availability, now }: OfferSlotInput & { date: ISODateString }): OfferTimeSlot[] {
  const day = parseDateKey(date);
  if (!day) return [];
  const range = offerSlotRange(availability, day);
  const earliest = earliestAllowedOfferStart(now).getTime();
  const latest = latestAllowedOfferStart(urgency, now).getTime();
  const first = Math.ceil(timeToMinutes(range.start) / OFFER_SLOT_MINUTES) * OFFER_SLOT_MINUTES;
  const slots: OfferTimeSlot[] = [];
  for (let minutes = first; minutes < timeToMinutes(range.end); minutes += OFFER_SLOT_MINUTES) {
    const at = slotStart(day, minutes).getTime();
    slots.push({ time: minutesToTime(minutes), disabled: at < earliest || at > latest });
  }
  return slots;
}

export interface OfferDateOption {
  date: ISODateString;
  /** No slot of that day can be picked. */
  disabled: boolean;
}

/** Today and the next days (at most 7, never past the urgency window); days without a free slot are disabled. */
export function offerDateOptions({ urgency, availability, now, maxDays = OFFER_DATE_PICKER_DAYS }: OfferSlotInput & { maxDays?: number }): OfferDateOption[] {
  const today = startOfLocalDay(now);
  return Array.from({ length: offerDateDays(urgency, now, maxDays) }, (_, index) => {
    const date = toDateKey(addDays(today, index));
    return { date, disabled: offerTimeSlots({ date, urgency, availability, now }).every((slot) => slot.disabled) };
  });
}

interface SuggestOfferStartInput {
  request: Pick<ServiceRequest, 'urgency' | 'preferredSchedule'>;
  availability?: WeeklyAvailability | null;
  now: DateInput;
}

/**
 * A sensible preselected appointment on the form's grid (an enabled date chip and time slot), an
 * hour or more from now when possible:
 * 1. the customer's preferred date and window, else
 * 2. the first free slot from a target day that depends on the urgency (emergency: today, urgent:
 *    tomorrow, normal: in 2 days, flexible: in 3 days), then the days before it, else
 * 3. the first free slot at all.
 * `null` when nothing fits.
 */
export function suggestOfferStart({ request, availability, now }: SuggestOfferStartInput): { date: string; time: string } | null {
  const input: OfferSlotInput = { urgency: request.urgency, availability, now };
  const options = offerDateOptions(input).filter((option) => !option.disabled);
  const leadLimit = toDate(now).getTime() + SUGGESTION_LEAD_MINUTES * 60_000;

  const freeSlots = (date: ISODateString) => offerTimeSlots({ ...input, date }).filter((slot) => !slot.disabled);
  const firstSuggested = (date: ISODateString, window?: SlotRange): string | null => {
    const day = parseDateKey(date);
    if (!day) return null;
    const slot = freeSlots(date).find((candidate) => {
      const minutes = timeToMinutes(candidate.time);
      const insideWindow = !window || (minutes >= timeToMinutes(window.start) && minutes < timeToMinutes(window.end));
      return insideWindow && slotStart(day, minutes).getTime() >= leadLimit;
    });
    return slot?.time ?? null;
  };

  // 1. Preferred date + window.
  const preferred = request.preferredSchedule;
  if (preferred && options.some((option) => option.date === preferred.date)) {
    const time = firstSuggested(preferred.date, preferred.timeWindow === 'any' ? undefined : TIME_WINDOW_RANGES[preferred.timeWindow]);
    if (time) return { date: preferred.date, time };
  }

  // 2. From the urgency's target day on, then the days before it.
  const offsetDays = { emergency: 0, urgent: 1, normal: 2, flexible: 3 }[request.urgency];
  const targetKey = toDateKey(addDays(startOfLocalDay(now), offsetDays));
  const ordered = [...options.filter((option) => option.date >= targetKey), ...options.filter((option) => option.date < targetKey)];
  for (const option of ordered) {
    const time = firstSuggested(option.date);
    if (time) return { date: option.date, time };
  }

  // 3. Any free slot (inside the suggestion lead time).
  for (const option of options) {
    const [slot] = freeSlots(option.date);
    if (slot) return { date: option.date, time: slot.time };
  }
  return null;
}

// ─────────────────────────────── Day periods ───────────────────────────────

/** The time step shows one part of the day at a time (a handful of slots instead of a wall). */
const OFFER_DAY_PERIODS = ['morning', 'afternoon', 'evening'] as const;
export type OfferDayPeriod = (typeof OFFER_DAY_PERIODS)[number];

/** Morning before 12:00, afternoon until 17:00, evening after (the customers' preferred windows). */
export function offerDayPeriod(time: TimeOfDayString): OfferDayPeriod {
  const minutes = timeToMinutes(time);
  if (minutes < timeToMinutes(TIME_WINDOW_RANGES.afternoon.start)) return 'morning';
  if (minutes < timeToMinutes(TIME_WINDOW_RANGES.evening.start)) return 'afternoon';
  return 'evening';
}

/** The periods that have at least one of `times`, each with its times (input order kept). */
export function groupTimesByPeriod(times: readonly TimeOfDayString[]): { period: OfferDayPeriod; times: TimeOfDayString[] }[] {
  return OFFER_DAY_PERIODS.map((period) => ({ period, times: times.filter((time) => offerDayPeriod(time) === period) })).filter(
    (group) => group.times.length > 0,
  );
}

type OfferFormField = keyof OfferFormValues;

/** Server `fieldErrors` paths → offer form fields (first message wins). */
export function mapOfferServerFieldErrors(fieldErrors: Record<string, string[]> | undefined): Partial<Record<OfferFormField, string>> {
  const result: Partial<Record<OfferFormField, string>> = {};
  if (!fieldErrors) return result;
  const target: Record<string, OfferFormField> = {
    price: 'price',
    currency: 'price',
    proposedStartAt: 'time',
    message: 'message',
  };
  for (const [path, messages] of Object.entries(fieldErrors)) {
    const field = target[path];
    if (field && messages[0] && !result[field]) result[field] = messages[0];
  }
  return result;
}

/** Business conflicts that are shown as a banner (instead of a field error). */
const OFFER_SUBMIT_PROBLEMS = [
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

/** Hours of the urgency window shown in the form's hint (`null` = no urgency limit). */
export function urgencyWindowHours(urgency: UrgencyLevel): number | null {
  if (urgency === 'emergency') return OFFER_TIME_RULES.emergencyMaxHours;
  if (urgency === 'urgent') return OFFER_TIME_RULES.urgentMaxHours;
  return null;
}
