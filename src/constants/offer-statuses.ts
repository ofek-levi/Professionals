/**
 * Offer status model. Transition rules live in `features/offers/offer-status-machine.ts`.
 * Labels are localized via `common:offerStatus.<status>`.
 */
import type { StatusTone } from './tones';

export const OFFER_STATUSES = ['pending', 'accepted', 'rejected', 'withdrawn', 'expired'] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export interface OfferStatusMeta {
  status: OfferStatus;
  tone: StatusTone;
  icon: string;
  /** Counts as the professional's "active" offer on a request (blocks duplicates). */
  isActive: boolean;
  isTerminal: boolean;
}

export const OFFER_STATUS_META: Record<OfferStatus, OfferStatusMeta> = {
  pending: { status: 'pending', tone: 'info', icon: 'timer-sand', isActive: true, isTerminal: false },
  accepted: { status: 'accepted', tone: 'success', icon: 'check-circle-outline', isActive: true, isTerminal: true },
  rejected: { status: 'rejected', tone: 'neutral', icon: 'close-circle-outline', isActive: false, isTerminal: true },
  withdrawn: { status: 'withdrawn', tone: 'neutral', icon: 'undo-variant', isActive: false, isTerminal: true },
  expired: { status: 'expired', tone: 'warning', icon: 'clock-alert-outline', isActive: false, isTerminal: true },
};

export function isOfferStatus(value: unknown): value is OfferStatus {
  return typeof value === 'string' && (OFFER_STATUSES as readonly string[]).includes(value);
}
