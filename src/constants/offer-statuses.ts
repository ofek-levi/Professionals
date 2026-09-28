/**
 * Offer status model. Transition rules live in `features/offers/offer-status-machine.ts`.
 * Labels are localized via `common:offerStatus.<status>`.
 */
import type { StatusTone } from './tones';

export const OFFER_STATUSES = ['pending', 'accepted', 'rejected', 'withdrawn', 'expired'] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

interface OfferStatusMeta {
  tone: StatusTone;
  /** Counts as the professional's "active" offer on a request (blocks duplicates). */
  isActive: boolean;
}

export const OFFER_STATUS_META: Record<OfferStatus, OfferStatusMeta> = {
  pending: { tone: 'info', isActive: true },
  accepted: { tone: 'success', isActive: true },
  rejected: { tone: 'neutral', isActive: false },
  withdrawn: { tone: 'neutral', isActive: false },
  expired: { tone: 'warning', isActive: false },
};
