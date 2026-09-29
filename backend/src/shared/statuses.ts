/**
 * Request, offer and job status models (copied from the app's `frontend/src/constants/*-statuses.ts`;
 * the drift test keeps the ids equal). Transition rules live in the owning modules.
 */
export const REQUEST_STATUSES = [
  'draft',
  'open',
  'offers_received',
  'professional_selected',
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/** Statuses in which professionals may still submit offers (`REQUEST_STATUS_META.acceptsOffers`). */
export const REQUEST_STATUSES_ACCEPTING_OFFERS = ['open', 'offers_received'] as const satisfies readonly RequestStatus[];

export function requestAcceptsOffers(status: RequestStatus): boolean {
  return (REQUEST_STATUSES_ACCEPTING_OFFERS as readonly RequestStatus[]).includes(status);
}

/** Customer "My requests" sections; each request belongs to exactly one. */
export const CUSTOMER_REQUEST_SECTIONS = ['drafts', 'awaiting_offers', 'has_offers', 'active', 'completed', 'cancelled'] as const;
export type CustomerRequestSection = (typeof CUSTOMER_REQUEST_SECTIONS)[number];

export const OFFER_STATUSES = ['pending', 'accepted', 'rejected', 'withdrawn', 'expired'] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

/** Offers that block a second offer by the same professional on the same request. */
export const ACTIVE_OFFER_STATUSES = ['pending', 'accepted'] as const satisfies readonly OfferStatus[];

export const OFFER_STATUS_REASONS = [
  'accepted_by_customer',
  'another_offer_accepted',
  'request_cancelled',
  'withdrawn_by_professional',
  'expired',
] as const;
export type OfferStatusReason = (typeof OFFER_STATUS_REASONS)[number];

export const JOB_STATUSES = ['awaiting_confirmation', 'scheduled', 'in_progress', 'completed', 'cancelled'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const ACTIVE_JOB_STATUSES = ['awaiting_confirmation', 'scheduled', 'in_progress'] as const satisfies readonly JobStatus[];

/** The request status that mirrors each job status (`JOB_STATUS_META.requestStatus`). */
export const REQUEST_STATUS_FOR_JOB_STATUS: Record<JobStatus, RequestStatus> = {
  awaiting_confirmation: 'professional_selected',
  scheduled: 'scheduled',
  in_progress: 'in_progress',
  completed: 'completed',
  cancelled: 'cancelled',
};
