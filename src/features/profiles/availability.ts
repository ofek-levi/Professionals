/**
 * Weekly working hours of a professional ("appointment availability").
 * Times are local `HH:mm`; a day is available when `enabled` and `start < end`.
 */
import type { DayAvailability, TimeOfDayString, Weekday, WeeklyAvailability } from '@/types/domain';
import { WEEKDAYS } from '@/types/domain';
import {
  addDays,
  isValidTimeOfDay,
  minutesOfDay,
  roundUpToMinutes,
  startOfLocalDay,
  timeToMinutes,
  toDate,
  type DateInput,
} from '@/utils/dates';

/** Typical Israeli work week: Sunday–Thursday full days, Friday morning, Saturday off. */
export function createDefaultAvailability(): WeeklyAvailability {
  const workday: DayAvailability = { enabled: true, start: '08:00', end: '18:00' };
  return {
    days: {
      sun: { ...workday },
      mon: { ...workday },
      tue: { ...workday },
      wed: { ...workday },
      thu: { ...workday },
      fri: { enabled: true, start: '08:00', end: '13:00' },
      sat: { enabled: false, start: '09:00', end: '17:00' },
    },
    acceptsEmergencyCalls: false,
  };
}

/** Local weekday of an instant. */
export function weekdayOf(value: DateInput): Weekday {
  return WEEKDAYS[toDate(value).getDay()];
}

/** A disabled day is always valid; an enabled day needs valid times with `end` after `start`. */
export function isValidDayAvailability(day: DayAvailability): boolean {
  if (!isValidTimeOfDay(day.start) || !isValidTimeOfDay(day.end)) return !day.enabled;
  return !day.enabled || timeToMinutes(day.end) > timeToMinutes(day.start);
}

export function hasAnyWorkingDay(availability: WeeklyAvailability): boolean {
  return WEEKDAYS.some((weekday) => availability.days[weekday].enabled);
}

export function isValidWeeklyAvailability(availability: WeeklyAvailability): boolean {
  return hasAnyWorkingDay(availability) && WEEKDAYS.every((weekday) => isValidDayAvailability(availability.days[weekday]));
}

/** Working hours for the local date of `value`, or `null` on a day off. */
export function getWorkingHoursForDate(
  availability: WeeklyAvailability,
  value: DateInput,
): { start: TimeOfDayString; end: TimeOfDayString } | null {
  const day = availability.days[weekdayOf(value)];
  if (!day.enabled || !isValidDayAvailability(day)) return null;
  return { start: day.start, end: day.end };
}

/**
 * Whether an appointment starting at `value` (and lasting `durationMinutes`) fits the working hours
 * of that day. With the default duration of 0 the start must be before the end of the day.
 */
export function isWithinWorkingHours(availability: WeeklyAvailability, value: DateInput, durationMinutes = 0): boolean {
  const hours = getWorkingHoursForDate(availability, value);
  if (!hours) return false;
  const start = minutesOfDay(value);
  const dayStart = timeToMinutes(hours.start);
  const dayEnd = timeToMinutes(hours.end);
  return start >= dayStart && (durationMinutes > 0 ? start + durationMinutes <= dayEnd : start < dayEnd);
}

export interface NextSlotOptions {
  /** Slot granularity in minutes (default 15). */
  slotMinutes?: number;
  /** The appointment must fit before the end of the working day (default 60). */
  durationMinutes?: number;
  /** How many days ahead to search (default 14). */
  maxDays?: number;
}

/**
 * Earliest slot-aligned start at or after `from` inside the working hours, or `null` if the
 * professional does not work within `maxDays`.
 */
export function findNextWorkingSlot(
  availability: WeeklyAvailability,
  from: DateInput,
  { slotMinutes = 15, durationMinutes = 60, maxDays = 14 }: NextSlotOptions = {},
): Date | null {
  const earliest = roundUpToMinutes(from, slotMinutes);
  for (let offset = 0; offset <= maxDays; offset += 1) {
    const day = addDays(startOfLocalDay(earliest), offset);
    const hours = getWorkingHoursForDate(availability, day);
    if (!hours) continue;
    const dayStart = timeToMinutes(hours.start);
    const dayEnd = timeToMinutes(hours.end);
    let candidateMinutes = offset === 0 ? Math.max(dayStart, minutesOfDay(earliest)) : dayStart;
    candidateMinutes = Math.ceil(candidateMinutes / slotMinutes) * slotMinutes;
    if (candidateMinutes + durationMinutes <= dayEnd) {
      const candidate = new Date(day.getTime());
      candidate.setHours(Math.floor(candidateMinutes / 60), candidateMinutes % 60, 0, 0);
      return candidate;
    }
  }
  return null;
}
