import { OFFER_STATUSES } from '@/constants/offer-statuses';

import {
  assertOfferTransition,
  canCustomerAcceptOffer,
  computeOfferExpiry,
  getOfferAcceptBlocker,
  getProfessionalOfferActions,
  getProfessionalOfferOutcome,
  isOfferActive,
  isOfferExpired,
} from '../offer-status-machine';

const NOW = new Date('2026-09-27T07:00:00.000Z');
const hours = (h: number) => new Date(NOW.getTime() + h * 3_600_000).toISOString();

describe('offer status machine', () => {
  it('only allows leaving pending (all other states are terminal)', () => {
    for (const from of OFFER_STATUSES) {
      for (const to of OFFER_STATUSES) {
        const assertion = expect(() => assertOfferTransition(from, to));
        if (from === 'pending' && to !== 'pending') assertion.not.toThrow();
        else assertion.toThrow(expect.objectContaining({ code: 'INVALID_STATE_TRANSITION' }));
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

  it('lets the customer accept only a live pending offer on a request that still takes offers', () => {
    const pending = { status: 'pending' as const, expiresAt: hours(3) };
    const request = { status: 'offers_received' as const, acceptedOfferId: null };
    expect(getOfferAcceptBlocker(pending, request, NOW)).toBeNull();
    expect(canCustomerAcceptOffer(pending, request, NOW)).toBe(true);
    expect(getOfferAcceptBlocker(pending, { ...request, acceptedOfferId: 'off_1' }, NOW)).toBe('already_accepted');
    expect(getOfferAcceptBlocker(pending, request, hours(3))).toBe('offer_expired');
    expect(getOfferAcceptBlocker({ ...pending, status: 'rejected' }, request, NOW)).toBe('offer_not_pending');
    expect(getOfferAcceptBlocker(pending, { ...request, status: 'cancelled' }, NOW)).toBe('request_closed');
    expect(canCustomerAcceptOffer(pending, { ...request, status: 'professional_selected' }, NOW)).toBe(false);
  });

  it('reads an accepted offer on a cancelled request as a cancelled job for the professional', () => {
    expect(getProfessionalOfferOutcome('accepted', 'scheduled')).toBe('accepted');
    expect(getProfessionalOfferOutcome('accepted', 'completed')).toBe('accepted');
    expect(getProfessionalOfferOutcome('accepted', 'cancelled')).toBe('job_cancelled');
    expect(getProfessionalOfferOutcome('rejected', 'cancelled')).toBe('rejected');
    expect(getProfessionalOfferOutcome('pending', 'offers_received')).toBe('pending');
  });
});
