/**
 * Pure date/time helpers shared by validation, business rules and the mock backend.
 *
 * Conventions:
 * - Instants are ISO-8601 strings in UTC (`ISODateTimeString`) or `Date` objects.
 * - Calendar dates are `YYYY-MM-DD` keys and wall-clock times are `HH:mm`, both interpreted in the
 *   device's local time zone (the service location's time zone for a local marketplace).
 *
 * Formatting for display lives in `utils/format.ts` (localized); nothing here is user facing.
 */
import {
  addDays as addDaysFns,
  addMinutes as addMinutesFns,
  differenceInCalendarDays,
  isSameDay as isSameDayFns,
  startOfDay,
} from 'date-fns';

import type { ISODateString, ISODateTimeString, PreferredTimeWindow, TimeOfDayString } from '@/types/domain';

export type DateInput = Date | ISODateTimeString;

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MINUTES_PER_DAY = 24 * 60;

/** Hour ranges of the preferred time windows (must match the `common:timeWindow.*` labels). */
export const TIME_WINDOW_RANGES: Record<Exclude<PreferredTimeWindow, 'any'>, { start: TimeOfDayString; end: TimeOfDayString }> = {
  morning: { start: '08:00', end: '12:00' },
  afternoon: { start: '12:00', end: '17:00' },
  evening: { start: '17:00', end: '21:00' },
};

const pad = (value: number) => String(value).padStart(2, '0');

export function toDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value);
}

/** True for a parseable ISO date-time string. */
export function isValidDateTimeString(value: unknown): value is ISODateTimeString {
  return typeof value === 'string' && value.length >= 10 && !Number.isNaN(Date.parse(value));
}

/** Local calendar date key `YYYY-MM-DD`. */
export function toDateKey(value: DateInput): ISODateString {
  const date = toDate(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Parses a `YYYY-MM-DD` key into local midnight, or `null` when invalid (e.g. `2026-02-30`). */
export function parseDateKey(key: string): Date | null {
  const match = DATE_KEY_PATTERN.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

export function isValidDateKey(value: unknown): value is ISODateString {
  return typeof value === 'string' && parseDateKey(value) !== null;
}

export function isValidTimeOfDay(value: unknown): value is TimeOfDayString {
  return typeof value === 'string' && TIME_OF_DAY_PATTERN.test(value);
}

/** `HH:mm` → minutes since midnight. Throws for malformed input. */
export function timeToMinutes(time: TimeOfDayString): number {
  const match = TIME_OF_DAY_PATTERN.exec(time);
  if (!match) throw new RangeError(`Invalid time of day: ${time}`);
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Minutes since midnight → `HH:mm` (wraps around midnight). */
export function minutesToTime(minutes: number): TimeOfDayString {
  const normalized = ((Math.round(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${pad(Math.floor(normalized / 60))}:${pad(normalized % 60)}`;
}

/** Local wall-clock time of an instant, `HH:mm`. */
function toTimeOfDay(value: DateInput): TimeOfDayString {
  const date = toDate(value);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Minutes since local midnight of an instant. */
export function minutesOfDay(value: DateInput): number {
  const date = toDate(value);
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Combines a local date key and a local `HH:mm` time into an ISO instant.
 * Throws a `RangeError` for invalid input – validate with `isValidDateKey` / `isValidTimeOfDay` first.
 */
export function combineDateAndTime(dateKey: ISODateString, time: TimeOfDayString): ISODateTimeString {
  const date = parseDateKey(dateKey);
  if (!date) throw new RangeError(`Invalid date key: ${dateKey}`);
  const minutes = timeToMinutes(time);
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date.toISOString();
}

/** Non-throwing variant of `combineDateAndTime`. */
export function tryCombineDateAndTime(dateKey: string, time: string): ISODateTimeString | null {
  return isValidDateKey(dateKey) && isValidTimeOfDay(time) ? combineDateAndTime(dateKey, time) : null;
}

/** Splits an instant into local `{ date: 'YYYY-MM-DD', time: 'HH:mm' }` (e.g. to prefill a form). */
export function splitDateTime(value: DateInput): { date: ISODateString; time: TimeOfDayString } {
  return { date: toDateKey(value), time: toTimeOfDay(value) };
}

export function addDays(value: DateInput, amount: number): Date {
  return addDaysFns(toDate(value), amount);
}

export function addMinutes(value: DateInput, amount: number): Date {
  return addMinutesFns(toDate(value), amount);
}

/** Local midnight of the given instant. */
export function startOfLocalDay(value: DateInput): Date {
  return startOfDay(toDate(value));
}

export function isSameDay(a: DateInput, b: DateInput): boolean {
  return isSameDayFns(toDate(a), toDate(b));
}

/** Calendar days from date key `from` to date key `to` (e.g. today → tomorrow = 1). */
export function daysBetweenDateKeys(from: ISODateString, to: ISODateString): number {
  const a = parseDateKey(from);
  const b = parseDateKey(to);
  if (!a || !b) throw new RangeError(`Invalid date keys: ${from}, ${to}`);
  return differenceInCalendarDays(b, a);
}

/** Rounds an instant up to the next multiple of `stepMinutes` (local wall clock). */
export function roundUpToMinutes(value: DateInput, stepMinutes: number): Date {
  const date = new Date(toDate(value).getTime());
  const hasSubMinute = date.getSeconds() > 0 || date.getMilliseconds() > 0;
  date.setSeconds(0, 0);
  const minutes = date.getMinutes() + (hasSubMinute ? 1 : 0);
  const rounded = Math.ceil(minutes / stepMinutes) * stepMinutes;
  date.setMinutes(rounded);
  return date;
}
