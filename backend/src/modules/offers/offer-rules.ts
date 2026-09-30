/**
 * Offer rules ported from the app (`features/offers/offer-rules.ts` + `offer-status-machine.ts`):
 * the status machine, the proposed-time rules, expiry and the accept blockers. The server is the
 * authority; the app runs the same rules to shape its forms and buttons.
 */
import { ApiError } from '../../lib/errors.js';
import { APP_CONFIG } from '../../shared/limits.js';
import { requestAcceptsOffers, type OfferStatus, type RequestStatus } from '../../shared/statuses.js';
import { URGENCY_META, type UrgencyLevel } from '../../shared/urgency.js';
import { vm, type ValidationMessage } from '../../shared/validation-messages.js';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const OFFER_TIME_RULES = {
  /** A proposed start must be at least this far in the future. */
  minLeadMinutes: 30,
  maxDaysAhead: APP_CONFIG.maxScheduleDaysAhead,
  /** Emergency requests must be handled within this many hours, urgent ones within `urgentMaxHours`. */
  emergencyMaxHours: 24,
  urgentMaxHours: 72,
} as const;

/** `pending → accepted | rejected | withdrawn | expired`; the others are terminal. */
const OFFER_TRANSITIONS: Record<OfferStatus, readonly OfferStatus[]> = {
  pending: ['accepted', 'rejected', 'withdrawn', 'expired'],
  accepted: [],
  rejected: [],
  withdrawn: [],
  expired: [],
};

/** 409 `INVALID_STATE_TRANSITION` for a disallowed move. */
export function assertOfferTransition(from: OfferStatus, to: OfferStatus): void {
  if (!OFFER_TRANSITIONS[from].includes(to)) throw ApiError.invalidTransition('offer', from, to);
}

/** Latest allowed start for an urgency (the stricter of its window and the global limit). */
export function latestAllowedOfferStart(urgency: UrgencyLevel, now: Date): Date {
  const nowMs = now.getTime();
  let latest = nowMs + OFFER_TIME_RULES.maxDaysAhead * DAY_MS;
  if (urgency === 'emergency') latest = Math.min(latest, nowMs + OFFER_TIME_RULES.emergencyMaxHours * HOUR_MS);
  if (urgency === 'urgent') latest = Math.min(latest, nowMs + OFFER_TIME_RULES.urgentMaxHours * HOUR_MS);
  return new Date(latest);
}

/** The first rule a proposed start breaks, or `null` (field `proposedStartAt`). */
function proposedStartIssue(proposedStartAt: Date, urgency: UrgencyLevel, now: Date): ValidationMessage | null {
  const startMs = proposedStartAt.getTime();
  const nowMs = now.getTime();
  if (Number.isNaN(startMs)) return vm('offer.startInvalid');
  if (startMs < nowMs + OFFER_TIME_RULES.minLeadMinutes * MINUTE_MS) return vm('offer.startTooSoon');
  if (startMs > nowMs + OFFER_TIME_RULES.maxDaysAhead * DAY_MS) return vm('offer.startTooFar');
  if (urgency === 'emergency' && startMs > nowMs + OFFER_TIME_RULES.emergencyMaxHours * HOUR_MS) return vm('offer.emergencyWindow');
  if (urgency === 'urgent' && startMs > nowMs + OFFER_TIME_RULES.urgentMaxHours * HOUR_MS) return vm('offer.urgentWindow');
  return null;
}

export function assertProposedStart(proposedStartAt: Date, urgency: UrgencyLevel, now: Date): void {
  const issue = proposedStartIssue(proposedStartAt, urgency, now);
  if (issue) throw ApiError.validation({ proposedStartAt: [issue] }, 'The proposed time is not allowed');
}

/**
 * Pending offers stay valid for the urgency's `offerValidityHours`, never past the proposed start
 * (an offer for a time that has passed is meaningless).
 */
export function computeOfferExpiry(urgency: UrgencyLevel, proposedStartAt: Date, now: Date): Date {
  const validUntil = now.getTime() + URGENCY_META[urgency].offerValidityHours * HOUR_MS;
  return new Date(Math.min(validUntil, proposedStartAt.getTime()));
}

/** Expired explicitly, or pending past `expiresAt` (the cron has not run yet). */
function isOfferExpired(offer: { status: OfferStatus; expiresAt: Date }, now: Date): boolean {
  if (offer.status === 'expired') return true;
  return offer.status === 'pending' && offer.expiresAt.getTime() <= now.getTime();
}

/** Only ILS is supported for now (the app's `APP_CONFIG.defaultCurrency`). */
export function assertSupportedCurrency(currency: string | undefined): void {
  if (currency !== undefined && currency !== APP_CONFIG.defaultCurrency) {
    throw ApiError.validation({ currency: [vm('offer.currencyUnsupported')] });
  }
}

/**
 * The accept rule shared with the customer's Accept buttons; each blocker maps to its REST error.
 * Order matters (same as the app's `getOfferAcceptBlocker`).
 */
export function assertOfferAcceptable(
  offer: { status: OfferStatus; expiresAt: Date },
  request: { status: RequestStatus; acceptedOffer: unknown },
  now: Date,
): void {
  if (request.acceptedOffer !== null) throw ApiError.conflict('An offer has already been accepted for this request');
  if (isOfferExpired(offer, now)) throw ApiError.conflict('This offer has expired', 'OFFER_EXPIRED');
  if (offer.status !== 'pending') throw ApiError.invalidTransition('offer', offer.status, 'accepted');
  if (!requestAcceptsOffers(request.status)) {
    throw ApiError.conflict('This request no longer accepts offers', 'REQUEST_NOT_ACCEPTING_OFFERS');
  }
}

/** Editable (update/withdraw-able) pending offer on a request that still takes offers. */
export function assertOfferEditable(offer: { status: OfferStatus; expiresAt: Date }, requestStatus: RequestStatus, now: Date): void {
  if (isOfferExpired(offer, now)) throw ApiError.conflict('This offer has expired', 'OFFER_EXPIRED');
  if (offer.status !== 'pending') throw ApiError.invalidTransition('offer', offer.status, 'pending');
  if (!requestAcceptsOffers(requestStatus)) {
    throw ApiError.conflict('This request no longer accepts offers', 'REQUEST_NOT_ACCEPTING_OFFERS');
  }
}
