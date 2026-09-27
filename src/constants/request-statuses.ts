/**
 * Marketplace-level status of a service request.
 * Transition rules live in `features/requests/request-status-machine.ts`.
 * Labels are localized via `common:requestStatus.<status>`.
 */
import type { StatusTone } from './tones';

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

export interface RequestStatusMeta {
  status: RequestStatus;
  tone: StatusTone;
  icon: string;
  /** Professionals may still submit offers. */
  acceptsOffers: boolean;
  /** A professional has been selected and the job is ongoing. */
  isActiveJob: boolean;
  /** No further transitions are possible. */
  isTerminal: boolean;
}

export const REQUEST_STATUS_META: Record<RequestStatus, RequestStatusMeta> = {
  draft: { status: 'draft', tone: 'neutral', icon: 'file-document-edit-outline', acceptsOffers: false, isActiveJob: false, isTerminal: false },
  open: { status: 'open', tone: 'info', icon: 'progress-clock', acceptsOffers: true, isActiveJob: false, isTerminal: false },
  offers_received: { status: 'offers_received', tone: 'brand', icon: 'tag-multiple-outline', acceptsOffers: true, isActiveJob: false, isTerminal: false },
  professional_selected: { status: 'professional_selected', tone: 'accent', icon: 'account-check-outline', acceptsOffers: false, isActiveJob: true, isTerminal: false },
  scheduled: { status: 'scheduled', tone: 'accent', icon: 'calendar-check-outline', acceptsOffers: false, isActiveJob: true, isTerminal: false },
  in_progress: { status: 'in_progress', tone: 'warning', icon: 'progress-wrench', acceptsOffers: false, isActiveJob: true, isTerminal: false },
  completed: { status: 'completed', tone: 'success', icon: 'check-decagram-outline', acceptsOffers: false, isActiveJob: false, isTerminal: true },
  cancelled: { status: 'cancelled', tone: 'danger', icon: 'close-circle-outline', acceptsOffers: false, isActiveJob: false, isTerminal: true },
};

/** Statuses in which professionals can discover the request and send offers. */
export const OPEN_REQUEST_STATUSES: readonly RequestStatus[] = ['open', 'offers_received'];

/** Statuses representing an active (assigned) job. */
export const ACTIVE_JOB_REQUEST_STATUSES: readonly RequestStatus[] = ['professional_selected', 'scheduled', 'in_progress'];

/**
 * Customer "My requests" sections. Each request belongs to exactly one section.
 * `awaiting_offers` = open with no offers yet, `has_offers` = offers waiting for a decision.
 */
export const CUSTOMER_REQUEST_SECTIONS = [
  'drafts',
  'awaiting_offers',
  'has_offers',
  'active',
  'completed',
  'cancelled',
] as const;
export type CustomerRequestSection = (typeof CUSTOMER_REQUEST_SECTIONS)[number];

export function isRequestStatus(value: unknown): value is RequestStatus {
  return typeof value === 'string' && (REQUEST_STATUSES as readonly string[]).includes(value);
}
