import { OFFER_STATUSES } from '@/constants/offer-statuses';

import { computeRequestOfferStats } from '../offer-counters';
import {
  assertOfferTransition,
  canTransitionOffer,
  computeOfferExpiry,
  getProfessionalOfferActions,
  isOfferActive,
  isOfferExpired,
} from '../offer-status-machine';

const NOW = new Date('2026-09-27T07:00:00.000Z');
const hours = (h: number) => new Date(NOW.getTime() + h * 3_600_000).toISOString();

describe('offer status machine', () => {
  it('only allows leaving pending (all other states are terminal)', () => {
    for (const from of OFFER_STATUSES) {
      for (const to of OFFER_STATUSES) {
        const allowed = from === 'pending' && to !== 'pending';
        expect(canTransitionOffer(from, to)).toBe(allowed);
      }
    }
    expect(() => assertOfferTransition('accepted', 'rejected')).toThrow(
      expect.objectContaining({ code: 'INVALID_STATE_TRANSITION' }),
    );
  });

  it('treats pending and accepted offers as active', () => {
    expect(isOfferActive('pending')).toBe(true);
    expect(isOfferActive('accepted')).toBe(true);
    expect(isOfferActive('withdrawn')).toBe(false);
    expect(isOfferActive('expired')).toBe(false);
    expect(isOfferActive('rejected')).toBe(false);
  });

  it('detects expiry by status or by time', () => {
    expect(isOfferExpired({ status: 'pending', expiresAt: hours(1) }, NOW)).toBe(false);
    expect(isOfferExpired({ status: 'pending', expiresAt: hours(0) }, NOW)).toBe(true);
    expect(isOfferExpired({ status: 'expired', expiresAt: hours(5) }, NOW)).toBe(true);
    expect(isOfferExpired({ status: 'accepted', expiresAt: hours(-5) }, NOW)).toBe(false);
  });

  it('computes expiry as min(now + urgency validity, proposed start)', () => {
    expect(computeOfferExpiry('urgent', hours(48), NOW)).toBe(hours(24));
    expect(computeOfferExpiry('emergency', hours(12), NOW)).toBe(hours(6));
    expect(computeOfferExpiry('normal', hours(5), NOW)).toBe(hours(5));
    expect(computeOfferExpiry('flexible', hours(24 * 30), NOW)).toBe(hours(24 * 7));
  });

  it('lets professionals edit/withdraw only pending offers on open requests', () => {
    const pending = { status: 'pending' as const, expiresAt: hours(3) };
    expect(getProfessionalOfferActions(pending, 'offers_received')).toEqual({ canEdit: true, canWithdraw: true });
    expect(getProfessionalOfferActions(pending, 'professional_selected')).toEqual({ canEdit: false, canWithdraw: false });
    expect(getProfessionalOfferActions({ ...pending, status: 'accepted' }, 'offers_received').canEdit).toBe(false);
    expect(getProfessionalOfferActions(pending, 'offers_received', hours(4)).canEdit).toBe(false);
  });

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
