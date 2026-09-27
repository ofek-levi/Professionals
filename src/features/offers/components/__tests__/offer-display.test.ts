import { expiryTone, getExpiryCountdown, roundCountdownMinutes, statusesForOfferFilter } from '../offer-display';

const now = new Date('2026-09-27T10:00:00.000Z');
const inMinutes = (minutes: number) => new Date(now.getTime() + minutes * 60_000).toISOString();

describe('offer display helpers', () => {
  it('maps status chips to query statuses', () => {
    expect(statusesForOfferFilter('pending')).toEqual(['pending']);
    expect(statusesForOfferFilter('rejected')).toEqual(['rejected']);
    expect(statusesForOfferFilter('all')).toBeUndefined();
  });

  it('computes the expiry countdown level', () => {
    expect(getExpiryCountdown(inMinutes(-1), now)).toEqual({ state: 'expired' });
    expect(getExpiryCountdown(now.toISOString(), now)).toEqual({ state: 'expired' });
    expect(getExpiryCountdown(inMinutes(0.2), now)).toEqual({ state: 'active', minutesLeft: 1, level: 'critical' });
    expect(getExpiryCountdown(inMinutes(45), now)).toEqual({ state: 'active', minutesLeft: 45, level: 'critical' });
    expect(getExpiryCountdown(inMinutes(5 * 60), now)).toEqual({ state: 'active', minutesLeft: 300, level: 'soon' });
    expect(getExpiryCountdown(inMinutes(30 * 60), now)).toEqual({ state: 'active', minutesLeft: 1800, level: 'normal' });
    expect(getExpiryCountdown('not a date', now)).toEqual({ state: 'expired' });
  });

  it('picks a tone per level', () => {
    expect(expiryTone({ state: 'expired' })).toBe('neutral');
    expect(expiryTone({ state: 'active', minutesLeft: 10, level: 'critical' })).toBe('danger');
    expect(expiryTone({ state: 'active', minutesLeft: 100, level: 'soon' })).toBe('warning');
    expect(expiryTone({ state: 'active', minutesLeft: 1000, level: 'normal' })).toBe('info');
  });

  it('rounds the remaining time for display', () => {
    expect(roundCountdownMinutes(42)).toEqual({ unit: 'minutes', minutes: 42 });
    expect(roundCountdownMinutes(128)).toEqual({ unit: 'minutes', minutes: 135 });
    expect(roundCountdownMinutes(7 * 60 + 20)).toEqual({ unit: 'hours', minutes: 420 });
    expect(roundCountdownMinutes(3 * 24 * 60 + 300)).toEqual({ unit: 'days', minutes: 3 * 24 * 60 });
  });
});
