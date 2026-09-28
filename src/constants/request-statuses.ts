/**
 * Marketplace-level status of a service request.
 * Transition rules live in `features/requests/request-status-machine.ts`.
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

interface RequestStatusMeta {
  /** Professionals may still submit offers. */
  acceptsOffers: boolean;
}

export const REQUEST_STATUS_META: Record<RequestStatus, RequestStatusMeta> = {
  draft: { acceptsOffers: false },
  open: { acceptsOffers: true },
  offers_received: { acceptsOffers: true },
  professional_selected: { acceptsOffers: false },
  scheduled: { acceptsOffers: false },
  in_progress: { acceptsOffers: false },
  completed: { acceptsOffers: false },
  cancelled: { acceptsOffers: false },
};

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
