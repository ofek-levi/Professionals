/**
 * Offer status machine: `pending → accepted | rejected | withdrawn | expired` (all terminal).
 * The UI uses it for the available actions of both roles; the backend enforces the same machine
 * (`backend/src/modules/offers/offer-rules.ts`).
 */
import { offerStatusMeta, type OfferStatus } from '@/constants/offer-statuses';
import type { RequestStatus } from '@/constants/request-statuses';
import { URGENCY_META, type UrgencyLevel } from '@/constants/urgency-levels';
import { requestAcceptsOffers } from '@/features/requests/request-status-machine';
import { assertTransition, type TransitionTable } from '@/features/shared/state-machine';
import type { ISODateTimeString, Offer, ServiceRequest } from '@/types/domain';
import { toDate, type DateInput } from '@/utils/dates';

const OFFER_TRANSITIONS: TransitionTable<OfferStatus> = {
  pending: ['accepted', 'rejected', 'withdrawn', 'expired'],
  accepted: [],
  rejected: [],
  withdrawn: [],
  expired: [],
};

/** Throws `DomainError` `INVALID_STATE_TRANSITION` (409) for disallowed transitions. */
export function assertOfferTransition(from: OfferStatus, to: OfferStatus): void {
  assertTransition(OFFER_TRANSITIONS, 'offer', from, to);
}

/** Pending or accepted – an active offer blocks the professional from sending another one. */
export function isOfferActive(status: OfferStatus): boolean {
  return offerStatusMeta(status).isActive;
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

interface ProfessionalOfferActions {
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

/** Why the owning customer cannot accept an offer right now. */
type OfferAcceptBlocker = 'already_accepted' | 'offer_expired' | 'offer_not_pending' | 'request_closed';

/**
 * The accept rule shared by `POST /offers/:id/accept` and the customer's Accept buttons: the
 * request has no accepted offer yet and still takes offers, and the offer is pending and not
 * expired. Returns the first reason it is blocked, or `null` when the customer may accept.
 */
export function getOfferAcceptBlocker(
  offer: Pick<Offer, 'status' | 'expiresAt'>,
  request: Pick<ServiceRequest, 'status' | 'acceptedOfferId'>,
  now: DateInput,
): OfferAcceptBlocker | null {
  if (request.acceptedOfferId !== null) return 'already_accepted';
  if (isOfferExpired(offer, now)) return 'offer_expired';
  if (offer.status !== 'pending') return 'offer_not_pending';
  if (!requestAcceptsOffers(request.status)) return 'request_closed';
  return null;
}

export function canCustomerAcceptOffer(
  offer: Pick<Offer, 'status' | 'expiresAt'>,
  request: Pick<ServiceRequest, 'status' | 'acceptedOfferId'>,
  now: DateInput,
): boolean {
  return getOfferAcceptBlocker(offer, request, now) === null;
}

/**
 * How an offer reads for the professional who sent it. `accepted` is terminal in the offer machine,
 * so when the customer later cancels the request (and with it the job) the offer stays `accepted`;
 * the request status turns it into `job_cancelled` so the UI never celebrates a cancelled job.
 */
export type ProfessionalOfferOutcome = OfferStatus | 'job_cancelled';

export function getProfessionalOfferOutcome(offerStatus: OfferStatus, requestStatus: RequestStatus): ProfessionalOfferOutcome {
  return offerStatus === 'accepted' && requestStatus === 'cancelled' ? 'job_cancelled' : offerStatus;
}
