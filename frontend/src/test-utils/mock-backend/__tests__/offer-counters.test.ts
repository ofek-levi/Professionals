import { OFFER_STATUSES } from '@/constants/offer-statuses';

import { computeRequestOfferStats } from '../server/offer-counters';

const NOW = new Date('2026-09-27T07:00:00.000Z');
const hours = (h: number) => new Date(NOW.getTime() + h * 3_600_000).toISOString();

describe('offer counters (test double)', () => {
  it('aggregates offer counters', () => {
    const offer = (status: (typeof OFFER_STATUSES)[number], price: number, createdAt: string) => ({ status, price, createdAt });
    expect(
      computeRequestOfferStats([
        offer('pending', 500, hours(-3)),
        offer('pending', 450, hours(-1)),
        offer('withdrawn', 100, hours(-2)),
        offer('expired', 300, hours(-4)),
      ]),
    ).toEqual({ offerCount: 3, pendingOfferCount: 2, latestOfferAt: hours(-1), lowestOfferPrice: 450 });
    expect(computeRequestOfferStats([])).toEqual({
      offerCount: 0,
      pendingOfferCount: 0,
      latestOfferAt: null,
      lowestOfferPrice: null,
    });
  });
});
