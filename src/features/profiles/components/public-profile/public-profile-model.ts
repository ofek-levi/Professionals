/**
 * Pure helpers of the public professional profile (weekly schedule rows, spoken languages).
 */
import { weekdayOf } from '@/features/profiles/availability';
import { WEEKDAYS, type TimeOfDayString, type Weekday, type WeeklyAvailability } from '@/types/domain';

export interface WeeklyScheduleRow {
  day: Weekday;
  isOpen: boolean;
  start: TimeOfDayString;
  end: TimeOfDayString;
  isToday: boolean;
}

/** One row per weekday (Sunday first, as in Israel), marking today. */
export function buildWeeklySchedule(availability: WeeklyAvailability, now: Date): WeeklyScheduleRow[] {
  const today = weekdayOf(now);
  return WEEKDAYS.map((day) => {
    const hours = availability.days[day];
    return { day, isOpen: hours.enabled, start: hours.start, end: hours.end, isToday: day === today };
  });
}

/** Languages with a translated name in `profile:public.languages.*`. */
export const KNOWN_LANGUAGE_CODES = ['he', 'en', 'ru', 'ar', 'fr', 'es', 'am', 'de', 'it', 'pt', 'uk', 'ro'] as const;
export type KnownLanguageCode = (typeof KNOWN_LANGUAGE_CODES)[number];

export function isKnownLanguageCode(code: string): code is KnownLanguageCode {
  return (KNOWN_LANGUAGE_CODES as readonly string[]).includes(code.toLowerCase());
}

/** Splits a bio into a preview for the collapsed "About" section. */
export const BIO_PREVIEW_LINES = 4;
export const BIO_LONG_THRESHOLD = 220;

export function isLongBio(bio: string): boolean {
  return bio.trim().length > BIO_LONG_THRESHOLD || bio.split('\n').length > BIO_PREVIEW_LINES;
}
