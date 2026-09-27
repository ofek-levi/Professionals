import {
  addDays,
  combineDateAndTime,
  daysBetweenDateKeys,
  isSameDay,
  isValidDateKey,
  isValidTimeOfDay,
  isWithinTimeWindow,
  minutesToTime,
  parseDateKey,
  roundUpToMinutes,
  splitDateTime,
  timeToMinutes,
  timeWindowForDate,
  toDateKey,
  tryCombineDateAndTime,
} from '../dates';

const local = (year: number, month: number, day: number, hour = 0, minute = 0) =>
  new Date(year, month - 1, day, hour, minute, 0, 0);

describe('date utils', () => {
  it('formats and parses local date keys', () => {
    expect(toDateKey(local(2026, 9, 7, 23, 59))).toBe('2026-09-07');
    expect(parseDateKey('2026-02-28')?.getDate()).toBe(28);
    expect(parseDateKey('2026-02-30')).toBeNull();
    expect(parseDateKey('2026-9-1')).toBeNull();
    expect(isValidDateKey('2026-12-31')).toBe(true);
    expect(isValidDateKey('31/12/2026')).toBe(false);
  });

  it('validates and converts times of day', () => {
    expect(isValidTimeOfDay('00:00')).toBe(true);
    expect(isValidTimeOfDay('23:59')).toBe(true);
    expect(isValidTimeOfDay('24:00')).toBe(false);
    expect(isValidTimeOfDay('9:00')).toBe(false);
    expect(timeToMinutes('08:30')).toBe(510);
    expect(minutesToTime(510)).toBe('08:30');
    expect(minutesToTime(-30)).toBe('23:30');
    expect(() => timeToMinutes('nope')).toThrow(RangeError);
  });

  it('combines a local date and time into an ISO instant and back', () => {
    const iso = combineDateAndTime('2026-10-01', '14:45');
    expect(iso).toBe(local(2026, 10, 1, 14, 45).toISOString());
    expect(splitDateTime(iso)).toEqual({ date: '2026-10-01', time: '14:45' });
    expect(tryCombineDateAndTime('2026-10-01', '25:00')).toBeNull();
    expect(() => combineDateAndTime('bad', '10:00')).toThrow(RangeError);
  });

  it('computes calendar day differences and same-day checks', () => {
    expect(daysBetweenDateKeys('2026-09-27', '2026-09-28')).toBe(1);
    expect(daysBetweenDateKeys('2026-09-27', '2026-09-20')).toBe(-7);
    expect(isSameDay(local(2026, 9, 27, 0, 1), local(2026, 9, 27, 23, 59))).toBe(true);
    expect(isSameDay(local(2026, 9, 27), addDays(local(2026, 9, 27), 1))).toBe(false);
  });

  it('rounds up to slots', () => {
    expect(roundUpToMinutes(local(2026, 9, 27, 10, 7), 15).getMinutes()).toBe(15);
    expect(roundUpToMinutes(local(2026, 9, 27, 10, 15), 15).getMinutes()).toBe(15);
    const late = roundUpToMinutes(local(2026, 9, 27, 23, 55), 15);
    expect(toDateKey(late)).toBe('2026-09-28');
    expect(late.getHours()).toBe(0);
  });

  it('maps instants to preferred time windows', () => {
    expect(timeWindowForDate(local(2026, 9, 27, 9, 0))).toBe('morning');
    expect(timeWindowForDate(local(2026, 9, 27, 12, 0))).toBe('afternoon');
    expect(timeWindowForDate(local(2026, 9, 27, 20, 59))).toBe('evening');
    expect(timeWindowForDate(local(2026, 9, 27, 22, 0))).toBe('any');
    expect(isWithinTimeWindow(local(2026, 9, 27, 7, 0), 'morning')).toBe(false);
    expect(isWithinTimeWindow(local(2026, 9, 27, 7, 0), 'any')).toBe(true);
  });
});
