/**
 * Display helpers for offers (professional "My offers" list and offer details): status filter
 * chips and the expiry countdown of pending offers. Pure and deterministic given `now`.
 */
import type { OfferStatus } from '@/constants/offer-statuses';
import type { StatusTone } from '@/constants/tones';
import type { ISODateTimeString } from '@/types/domain';
import { toDate, type DateInput } from '@/utils/dates';

/** Status chips on the professional's offers tab, in display order. */
export const PRO_OFFER_FILTERS = ['pending', 'accepted', 'rejected', 'withdrawn', 'expired', 'all'] as const;
export type ProOfferFilter = (typeof PRO_OFFER_FILTERS)[number];

/** `statuses` query param for a chip (`undefined` = every status). */
export function statusesForOfferFilter(filter: ProOfferFilter): OfferStatus[] | undefined {
  return filter === 'all' ? undefined : [filter];
}

/** Under an hour left: critical. Under six hours: soon. */
export const EXPIRY_CRITICAL_MINUTES = 60;
export const EXPIRY_SOON_MINUTES = 6 * 60;

export type ExpiryCountdown =
  | { state: 'expired' }
  | { state: 'active'; minutesLeft: number; level: 'critical' | 'soon' | 'normal' };

/** Minutes until `expiresAt` (rounded up) and how pressing it is. */
export function getExpiryCountdown(expiresAt: ISODateTimeString, now: DateInput): ExpiryCountdown {
  const msLeft = Date.parse(expiresAt) - toDate(now).getTime();
  if (!Number.isFinite(msLeft) || msLeft <= 0) return { state: 'expired' };
  const minutesLeft = Math.max(1, Math.ceil(msLeft / 60_000));
  const level = minutesLeft <= EXPIRY_CRITICAL_MINUTES ? 'critical' : minutesLeft <= EXPIRY_SOON_MINUTES ? 'soon' : 'normal';
  return { state: 'active', minutesLeft, level };
}

export function expiryTone(countdown: ExpiryCountdown): StatusTone {
  if (countdown.state === 'expired') return 'neutral';
  if (countdown.level === 'critical') return 'danger';
  if (countdown.level === 'soon') return 'warning';
  return 'info';
}

/**
 * Rounds the remaining time for display: minutes under an hour, whole quarter hours under six
 * hours, whole hours under two days, whole days beyond that.
 */
export function roundCountdownMinutes(minutesLeft: number): { unit: 'minutes' | 'hours' | 'days'; minutes: number } {
  if (minutesLeft < 60) return { unit: 'minutes', minutes: minutesLeft };
  if (minutesLeft < 6 * 60) return { unit: 'minutes', minutes: Math.round(minutesLeft / 15) * 15 };
  if (minutesLeft < 48 * 60) return { unit: 'hours', minutes: Math.round(minutesLeft / 60) * 60 };
  return { unit: 'days', minutes: Math.round(minutesLeft / (24 * 60)) * 24 * 60 };
}
