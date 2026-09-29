import type { OfferStatus, OfferWithProfessional } from '@/types/domain';

import { sortOffers } from '../offer-sorting';

let sequence = 0;
function offer(
  overrides: { status?: OfferStatus; price?: number; startInHours?: number; rating?: number | null; reviews?: number } = {},
): OfferWithProfessional {
  sequence += 1;
  const { status = 'pending', price = 500, startInHours = 24, rating = 4.5, reviews = 10 } = overrides;
  return {
    id: `off_${sequence}`,
    requestId: 'req_1',
    professionalId: `pro_${sequence}`,
    price,
    currency: 'ILS',
    proposedStartAt: new Date(Date.UTC(2026, 8, 27, 7) + startInHours * 3_600_000).toISOString(),
    estimatedDurationMinutes: 60,
    message: null,
    status,
    statusReason: null,
    expiresAt: '2026-09-30T00:00:00.000Z',
    createdAt: new Date(Date.UTC(2026, 8, 26, 7) + sequence * 60_000).toISOString(),
    updatedAt: '2026-09-26T07:00:00.000Z',
    respondedAt: null,
    distanceKm: 3,
    professional: {
      id: `pro_${sequence}`,
      displayName: `Pro ${sequence}`,
      avatarUrl: null,
      headline: '',
      categoryIds: ['plumbing'],
      yearsOfExperience: 5,
      averageRating: rating,
      reviewCount: rating === null ? 0 : reviews,
      completedJobsCount: reviews,
      isVerified: true,
      city: 'Tel Aviv-Yafo',
    },
  };
}

const ids = (list: OfferWithProfessional[]) => list.map((item) => item.id);

describe('offer sorting', () => {
  it('sorts by price, availability, rating and review count', () => {
    const cheap = offer({ price: 300, startInHours: 48, rating: 4.0, reviews: 5 });
    const early = offer({ price: 600, startInHours: 3, rating: 4.6, reviews: 40 });
    const star = offer({ price: 500, startInHours: 24, rating: 4.9, reviews: 12 });
    const list = [cheap, early, star];
    expect(ids(sortOffers(list, 'lowest_price'))).toEqual([cheap.id, star.id, early.id]);
    expect(ids(sortOffers(list, 'earliest_availability'))).toEqual([early.id, star.id, cheap.id]);
    expect(ids(sortOffers(list, 'highest_rating'))).toEqual([star.id, early.id, cheap.id]);
    expect(ids(sortOffers(list, 'most_reviews'))).toEqual([early.id, star.id, cheap.id]);
  });

  it('always puts the accepted offer first and non-pending offers last', () => {
    const accepted = offer({ status: 'accepted', price: 900 });
    const pending = offer({ price: 400 });
    const withdrawn = offer({ status: 'withdrawn', price: 100 });
    const expired = offer({ status: 'expired', price: 50 });
    for (const sort of ['recommended', 'lowest_price', 'earliest_availability', 'highest_rating', 'most_reviews'] as const) {
      const sorted = ids(sortOffers([withdrawn, expired, pending, accepted], sort));
      expect(sorted[0]).toBe(accepted.id);
      expect(sorted[1]).toBe(pending.id);
    }
  });

  it('recommends a balanced offer over an unproven cheap one', () => {
    const unproven = offer({ price: 350, startInHours: 30, rating: 5, reviews: 1 });
    const solid = offer({ price: 380, startInHours: 20, rating: 4.8, reviews: 60 });
    const expensive = offer({ price: 900, startInHours: 72, rating: 4.2, reviews: 8 });
    expect(ids(sortOffers([expensive, unproven, solid]))).toEqual([solid.id, unproven.id, expensive.id]);
  });
});
