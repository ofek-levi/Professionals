import { createDefaultAvailability } from '@/features/profiles/availability';
import type { WeeklyAvailability } from '@/types/domain';

import { groupWorkingHours, isLongBio } from '../public-profile-model';

const summarize = (availability: WeeklyAvailability) =>
  groupWorkingHours(availability).map((row) =>
    `${row.first}${row.first === row.last ? '' : `-${row.last}`} ${row.isOpen ? `${row.start}-${row.end}` : 'closed'}`,
  );

describe('groupWorkingHours', () => {
  it('collapses consecutive days with the same hours, starting on Sunday', () => {
    expect(summarize(createDefaultAvailability())).toEqual(['sun-thu 08:00-18:00', 'fri 08:00-13:00', 'sat closed']);
  });

  it('splits runs when hours or the open state change and groups closed days regardless of hours', () => {
    const availability = createDefaultAvailability();
    availability.days.tue = { enabled: true, start: '10:00', end: '18:00' };
    availability.days.fri = { enabled: false, start: '09:00', end: '12:00' };
    expect(summarize(availability)).toEqual([
      'sun-mon 08:00-18:00',
      'tue 10:00-18:00',
      'wed-thu 08:00-18:00',
      'fri-sat closed',
    ]);
  });
});

describe('isLongBio', () => {
  it('detects long bios', () => {
    expect(isLongBio('Short bio.')).toBe(false);
    expect(isLongBio('x'.repeat(300))).toBe(true);
    expect(isLongBio('a\nb\nc\nd\ne')).toBe(true);
  });
});
