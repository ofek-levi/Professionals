import type { DayAvailability } from '@/types/domain';

import {
  createDefaultAvailability,
  findNextWorkingSlot,
  getWorkingHoursForDate,
  hasAnyWorkingDay,
  isWithinWorkingHours,
} from '../availability';

// 2026-09-27 is a Sunday.
const local = (day: number, hour: number, minute = 0) => new Date(2026, 8, day, hour, minute);

describe('availability', () => {
  const availability = createDefaultAvailability();

  it('creates a typical Israeli work week', () => {
    expect(availability.days.sun).toEqual({ enabled: true, start: '08:00', end: '18:00' });
    expect(availability.days.fri).toEqual({ enabled: true, start: '08:00', end: '13:00' });
    expect(availability.days.sat.enabled).toBe(false);
    expect(hasAnyWorkingDay(availability)).toBe(true);
    // The factory returns fresh objects.
    expect(createDefaultAvailability()).not.toBe(availability);
  });

  it('only uses valid working days', () => {
    const sundayHours = (sun: DayAvailability) =>
      getWorkingHoursForDate({ ...availability, days: { ...availability.days, sun } }, local(27, 10));
    expect(sundayHours({ enabled: true, start: '09:00', end: '17:00' })).toEqual({ start: '09:00', end: '17:00' });
    expect(sundayHours({ enabled: true, start: '17:00', end: '09:00' })).toBeNull();
    expect(sundayHours({ enabled: true, start: '9', end: '17:00' })).toBeNull();
    expect(sundayHours({ enabled: false, start: '09:00', end: '17:00' })).toBeNull();
    const noDays = createDefaultAvailability();
    Object.values(noDays.days).forEach((day) => {
      day.enabled = false;
    });
    expect(hasAnyWorkingDay(noDays)).toBe(false);
  });

  it('checks working hours', () => {
    expect(isWithinWorkingHours(availability, local(27, 10))).toBe(true);
    expect(isWithinWorkingHours(availability, local(27, 7, 59))).toBe(false);
    expect(isWithinWorkingHours(availability, local(27, 18))).toBe(false);
    expect(isWithinWorkingHours(availability, local(27, 17), 120)).toBe(false);
    expect(isWithinWorkingHours(availability, local(26, 10))).toBe(false); // Saturday
  });

  it('finds the next working slot', () => {
    expect(findNextWorkingSlot(availability, local(27, 10, 7))).toEqual(local(27, 10, 15));
    // After hours on Sunday → Monday 08:00.
    expect(findNextWorkingSlot(availability, local(27, 17, 30), { durationMinutes: 60 })).toEqual(local(28, 8, 0));
    // Saturday → Sunday morning.
    expect(findNextWorkingSlot(availability, local(26, 11))).toEqual(local(27, 8, 0));
  });
});
