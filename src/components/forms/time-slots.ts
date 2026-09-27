import type { ISODateString, TimeOfDayString } from '@/types/domain';
import { minutesOfDay, minutesToTime, timeToMinutes, toDateKey } from '@/utils/dates';

export interface TimeSlot {
  time: TimeOfDayString;
  /** In the past (or inside the lead time) for today's date. */
  disabled: boolean;
}

export interface BuildTimeSlotsOptions {
  /** First slot, `HH:mm`. */
  start: TimeOfDayString;
  /** Slots start strictly before this time, `HH:mm`. */
  end: TimeOfDayString;
  stepMinutes: number;
  /** Selected date; when it is today, earlier slots are disabled. */
  date?: ISODateString | null;
  now: Date;
  /** Minimum notice for today's slots (minutes from now). */
  minLeadMinutes?: number;
}

/** Builds the selectable time grid (pure, deterministic given `now`). */
export function buildTimeSlots({ start, end, stepMinutes, date, now, minLeadMinutes = 0 }: BuildTimeSlotsOptions): TimeSlot[] {
  const first = timeToMinutes(start);
  const last = timeToMinutes(end);
  const step = Math.max(5, Math.round(stepMinutes));
  const isToday = Boolean(date) && date === toDateKey(now);
  const earliest = isToday ? minutesOfDay(now) + minLeadMinutes : -1;
  const slots: TimeSlot[] = [];
  for (let minutes = first; minutes < last; minutes += step) {
    slots.push({ time: minutesToTime(minutes), disabled: minutes < earliest });
  }
  return slots;
}
