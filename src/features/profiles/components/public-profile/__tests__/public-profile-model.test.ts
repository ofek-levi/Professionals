import { createDefaultAvailability } from '@/features/profiles/availability';

import { buildWeeklySchedule, isKnownLanguageCode, isLongBio } from '../public-profile-model';

describe('buildWeeklySchedule', () => {
  it('lists the week from Sunday and marks today', () => {
    // 2026-09-29 is a Tuesday.
    const rows = buildWeeklySchedule(createDefaultAvailability(), new Date(2026, 8, 29, 10, 0));
    expect(rows.map((row) => row.day)).toEqual(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']);
    expect(rows.filter((row) => row.isToday).map((row) => row.day)).toEqual(['tue']);
    expect(rows[5]).toMatchObject({ day: 'fri', isOpen: true, start: '08:00', end: '13:00' });
    expect(rows[6]).toMatchObject({ day: 'sat', isOpen: false });
  });
});

describe('profile helpers', () => {
  it('recognizes translated languages case-insensitively', () => {
    expect(isKnownLanguageCode('HE')).toBe(true);
    expect(isKnownLanguageCode('xx')).toBe(false);
  });

  it('detects long bios', () => {
    expect(isLongBio('Short bio.')).toBe(false);
    expect(isLongBio('x'.repeat(300))).toBe(true);
    expect(isLongBio('a\nb\nc\nd\ne')).toBe(true);
  });
});
