/**
 * Calendar dates of the marketplace. The app reads `YYYY-MM-DD` keys (preferred dates, explorer
 * date filters) in the device's local time; for a local marketplace that is `MARKET_TIME_ZONE`,
 * so the server evaluates "today", "midnight of that day" and "this month" in that zone.
 */
import { MARKET_TIME_ZONE } from '../../shared/domain.js';

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

const wallClockFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: MARKET_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

interface CalendarDay {
  year: number;
  month: number;
  day: number;
}

function wallClock(instant: Date): CalendarDay & { hour: number; minute: number; second: number } {
  const parts = Object.fromEntries(wallClockFormat.formatToParts(instant).map((part) => [part.type, part.value]));
  const read = (type: string) => Number(parts[type] ?? 0);
  return { year: read('year'), month: read('month'), day: read('day'), hour: read('hour'), minute: read('minute'), second: read('second') };
}

/** Market wall clock minus UTC at `instant`, in ms (e.g. +3 h in the Israeli summer). */
function zoneOffsetMs(instant: number): number {
  const wall = wallClock(new Date(instant));
  const wallAsUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  return wallAsUtc - Math.floor(instant / 1000) * 1000;
}

/** A real calendar day (`2026-02-30` is not). */
export function parseDateKey(key: string): CalendarDay | null {
  const match = DATE_KEY.exec(key);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { year, month, day };
}

export function isValidDateKey(value: string): boolean {
  return parseDateKey(value) !== null;
}

/** The market's calendar date at `instant`. */
export function marketDateKey(instant: Date): string {
  const { year, month, day } = wallClock(instant);
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** The instant the market day `key` starts (00:00 market time). */
export function marketMidnight(key: string): Date {
  const day = parseDateKey(key);
  if (!day) throw new RangeError(`Invalid date key: ${key}`);
  const utcMidnight = Date.UTC(day.year, day.month - 1, day.day);
  const firstGuess = utcMidnight - zoneOffsetMs(utcMidnight);
  // Re-read the offset at the guess in case a DST switch lies between the two instants.
  return new Date(utcMidnight - zoneOffsetMs(firstGuess));
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). */
export function daysBetweenDateKeys(from: string, to: string): number {
  const a = parseDateKey(from);
  const b = parseDateKey(to);
  if (!a || !b) throw new RangeError(`Invalid date keys: ${from}, ${to}`);
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / DAY_MS);
}

/** Start of the market month containing `instant` (dashboard "earnings this month"). */
export function marketMonthStart(instant: Date): Date {
  return marketMidnight(`${marketDateKey(instant).slice(0, 7)}-01`);
}
