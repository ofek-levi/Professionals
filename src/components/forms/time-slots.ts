import type { TimeOfDayString } from '@/types/domain';
import { minutesToTime, timeToMinutes } from '@/utils/dates';

interface BuildTimeSlotsOptions {
  /** First slot, `HH:mm`. */
  start: TimeOfDayString;
  /** Slots start strictly before this time, `HH:mm`. */
  end: TimeOfDayString;
  stepMinutes: number;
}

/** The selectable times of a time grid (pure). */
export function buildTimeSlots({ start, end, stepMinutes }: BuildTimeSlotsOptions): TimeOfDayString[] {
  const last = timeToMinutes(end);
  const step = Math.max(5, Math.round(stepMinutes));
  const times: TimeOfDayString[] = [];
  for (let minutes = timeToMinutes(start); minutes < last; minutes += step) times.push(minutesToTime(minutes));
  return times;
}
