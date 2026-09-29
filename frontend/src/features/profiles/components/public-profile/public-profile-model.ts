/**
 * Pure helpers of the public professional profile (compact working hours, bio preview).
 */
import { WEEKDAYS, type TimeOfDayString, type Weekday, type WeeklyAvailability } from '@/types/domain';

interface WorkingHoursRow {
  /** First and last day of a run of consecutive days with the same hours (equal for one day). */
  first: Weekday;
  last: Weekday;
  isOpen: boolean;
  start: TimeOfDayString;
  end: TimeOfDayString;
}

/**
 * Collapses the week (Sunday first, as in Israel) into runs of consecutive days with identical
 * hours: "Sun–Thu 08:00–18:00 · Fri 08:00–13:00 · Sat closed".
 */
export function groupWorkingHours(availability: WeeklyAvailability): WorkingHoursRow[] {
  const rows: WorkingHoursRow[] = [];
  for (const day of WEEKDAYS) {
    const hours = availability.days[day];
    const previous = rows[rows.length - 1];
    const sameAsPrevious =
      previous !== undefined &&
      previous.isOpen === hours.enabled &&
      (!hours.enabled || (previous.start === hours.start && previous.end === hours.end));
    if (sameAsPrevious) previous.last = day;
    else rows.push({ first: day, last: day, isOpen: hours.enabled, start: hours.start, end: hours.end });
  }
  return rows;
}

/** Lines of the bio shown before "Read more". */
export const BIO_PREVIEW_LINES = 4;
const BIO_LONG_THRESHOLD = 220;

export function isLongBio(bio: string): boolean {
  return bio.trim().length > BIO_LONG_THRESHOLD || bio.split('\n').length > BIO_PREVIEW_LINES;
}
