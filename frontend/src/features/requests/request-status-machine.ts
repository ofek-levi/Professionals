/**
 * Service request status machine (see docs/ARCHITECTURE.md → Status models).
 * Used by the mock backend to enforce transitions and by the UI to decide which actions to show.
 */
import {
  REQUEST_STATUS_META,
  type CustomerRequestSection,
  type RequestStatus,
} from '@/constants/request-statuses';
import { assertTransition, canTransition, type TransitionTable } from '@/features/shared/state-machine';
import type { ServiceRequest } from '@/types/domain';

const REQUEST_TRANSITIONS: TransitionTable<RequestStatus> = {
  draft: ['open', 'cancelled'],
  open: ['offers_received', 'cancelled'],
  offers_received: ['open', 'professional_selected', 'cancelled'],
  professional_selected: ['scheduled', 'cancelled'],
  scheduled: ['in_progress', 'completed', 'cancelled'],
  in_progress: ['completed'],
  completed: [],
  cancelled: [],
};

function canTransitionRequest(from: RequestStatus, to: RequestStatus): boolean {
  return canTransition(REQUEST_TRANSITIONS, from, to);
}

/** Throws `DomainError` `INVALID_STATE_TRANSITION` (409) for disallowed transitions. */
export function assertRequestTransition(from: RequestStatus, to: RequestStatus): void {
  assertTransition(REQUEST_TRANSITIONS, 'request', from, to);
}

function isRequestCancellable(status: RequestStatus): boolean {
  return canTransitionRequest(status, 'cancelled');
}

/** Whether professionals can still discover the request and send offers. */
export function requestAcceptsOffers(status: RequestStatus): boolean {
  return REQUEST_STATUS_META[status].acceptsOffers;
}

interface CustomerRequestActions {
  canCancel: boolean;
  canEditDraft: boolean;
  canDeleteDraft: boolean;
}

type RequestActionInput = Pick<ServiceRequest, 'status' | 'pendingOfferCount'>;

/** What the owning customer may do with a request right now. */
export function getCustomerRequestActions(request: RequestActionInput): CustomerRequestActions {
  const isDraft = request.status === 'draft';
  return {
    canCancel: isRequestCancellable(request.status),
    canEditDraft: isDraft,
    canDeleteDraft: isDraft,
  };
}

/** The "My requests" section a request belongs to (each request is in exactly one). */
export function getCustomerRequestSection(request: RequestActionInput): CustomerRequestSection {
  switch (request.status) {
    case 'draft':
      return 'drafts';
    case 'open':
      return request.pendingOfferCount > 0 ? 'has_offers' : 'awaiting_offers';
    case 'offers_received':
      return 'has_offers';
    case 'professional_selected':
    case 'scheduled':
    case 'in_progress':
      return 'active';
    case 'completed':
      return 'completed';
    case 'cancelled':
      return 'cancelled';
  }
}

/**
 * The status a request should have after its pending offer count changed
 * (`open ⇄ offers_received`). Other statuses are returned unchanged.
 */
export function requestStatusForPendingOffers(status: RequestStatus, pendingOfferCount: number): RequestStatus {
  if (status === 'open' && pendingOfferCount > 0) return 'offers_received';
  if (status === 'offers_received' && pendingOfferCount === 0) return 'open';
  return status;
}
