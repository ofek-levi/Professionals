import { createDefaultAvailability } from '@/features/profiles/availability';
import { WEEKDAYS } from '@/types/domain';

import { COMPLETENESS_ITEMS, COMPLETENESS_WEIGHTS, computeProfileCompleteness } from '../profile-completeness';

type Input = Parameters<typeof computeProfileCompleteness>[0];

const complete: Input = {
  avatarUrl: 'https://example.com/a.jpg',
  headline: 'Licensed plumber, fast and tidy',
  bio: 'Fifteen years fixing leaks, boilers and bathrooms across Tel Aviv.',
  categoryIds: ['plumbing'],
  baseLocation: {
    coordinates: { latitude: 32.08, longitude: 34.78 },
    addressLine: 'Dizengoff St 120',
    city: 'Tel Aviv-Yafo',
    neighborhood: null,
    details: null,
    isApproximate: false,
  },
  availability: createDefaultAvailability(),
  business: { businessName: 'Avi Plumbing', licenseNumber: 'PL-12345', isInsured: true, languages: ['he'] },
  startingPrice: { amount: 250, currency: 'ILS' },
  contact: { phone: '0501234567', email: 'avi@example.com', website: 'avi.co.il' },
};

describe('computeProfileCompleteness', () => {
  it('weights sum to 100', () => {
    expect(COMPLETENESS_ITEMS.reduce((sum, item) => sum + COMPLETENESS_WEIGHTS[item], 0)).toBe(100);
  });

  it('reports a complete profile', () => {
    const result = computeProfileCompleteness(complete);
    expect(result).toEqual({ percent: 100, completed: [...COMPLETENESS_ITEMS], missing: [], isComplete: true });
  });

  it('lists missing items, most valuable first', () => {
    const noDays = createDefaultAvailability();
    WEEKDAYS.forEach((day) => {
      noDays.days[day].enabled = false;
    });
    const result = computeProfileCompleteness({
      ...complete,
      avatarUrl: null,
      headline: 'Pro',
      contact: { ...complete.contact, website: null },
      business: { ...complete.business, licenseNumber: '  ', isInsured: false },
      availability: noDays,
    });
    expect(result.missing).toEqual(['photo', 'headline', 'availability', 'license', 'insurance', 'website']);
    expect(result.percent).toBe(100 - 15 - 10 - 10 - 10 - 5 - 5);
    expect(result.isComplete).toBe(false);
  });

  it('requires a bio of the minimum length', () => {
    const result = computeProfileCompleteness({ ...complete, bio: 'Too short' });
    expect(result.missing).toEqual(['bio']);
    expect(result.percent).toBe(85);
  });
});
