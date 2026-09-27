/**
 * Offer status machine: `pending → accepted | rejected | withdrawn | expired` (all terminal).
 * Shared by the mock backend (enforcement) and the professional UI (available actions).
 */
import { OFFER_STATUS_META, type OfferStatus } from '@/constants/offer-statuses';
import type { RequestStatus } from '@/constants/request-statuses';
import { URGENCY_META, type UrgencyLevel } from '@/constants/urgency-levels';
import { requestAcceptsOffers } from '@/features/requests/request-status-machine';
import { assertTransition, canTransition, type TransitionTable } from '@/features/shared/state-machine';
import type { ISODateTimeString, Offer } from '@/types/domain';
import { toDate, type DateInput } from '@/utils/dates';

export const OFFER_TRANSITIONS: TransitionTable<OfferStatus> = {
  pending: ['accepted', 'rejected', 'withdrawn', 'expired'],
  accepted: [],
  rejected: [],
  withdrawn: [],
  expired: [],
};

export function canTransitionOffer(from: OfferStatus, to: OfferStatus): boolean {
  return canTransition(OFFER_TRANSITIONS, from, to);
}

/** Throws `DomainError` `INVALID_STATE_TRANSITION` (409) for disallowed transitions. */
export function assertOfferTransition(from: OfferStatus, to: OfferStatus): void {
  assertTransition(OFFER_TRANSITIONS, 'offer', from, to);
}

/** Pending or accepted – an active offer blocks the professional from sending another one. */
export function isOfferActive(status: OfferStatus): boolean {
  return OFFER_STATUS_META[status].isActive;
}

/** Expired either explicitly or because a pending offer passed its `expiresAt`. */
export function isOfferExpired(offer: Pick<Offer, 'status' | 'expiresAt'>, now: DateInput): boolean {
  if (offer.status === 'expired') return true;
  return offer.status === 'pending' && Date.parse(offer.expiresAt) <= toDate(now).getTime();
}

/**
 * Pending offers stay valid for the urgency's `offerValidityHours`, but never past the proposed
 * appointment start (an offer for a time that has passed is meaningless).
 */
export function computeOfferExpiry(
  urgency: UrgencyLevel,
  proposedStartAt: DateInput,
  now: DateInput,
): ISODateTimeString {
  const validUntil = toDate(now).getTime() + URGENCY_META[urgency].offerValidityHours * 60 * 60 * 1000;
  const start = toDate(proposedStartAt).getTime();
  return new Date(Math.min(validUntil, start)).toISOString();
}

export interface ProfessionalOfferActions {
  canEdit: boolean;
  canWithdraw: boolean;
}

/** What the offering professional may do with their offer. Pass `now` to also respect expiry. */
export function getProfessionalOfferActions(
  offer: Pick<Offer, 'status' | 'expiresAt'>,
  requestStatus: RequestStatus,
  now?: DateInput,
): ProfessionalOfferActions {
  const editable =
    offer.status === 'pending' && requestAcceptsOffers(requestStatus) && !(now !== undefined && isOfferExpired(offer, now));
  return { canEdit: editable, canWithdraw: editable };
}
