import type { CurrencyCode, EntityId, ISODateTimeString } from './common';
import type { ProfessionalSummary } from './professional';
import type { ServiceRequest } from './request';
import type { OfferStatus } from '@/constants/offer-statuses';

export type { OfferStatus };

/** Why an offer left the `pending` state. */
export const OFFER_STATUS_REASONS = [
  'accepted_by_customer',
  'another_offer_accepted',
  'request_cancelled',
  'withdrawn_by_professional',
  'expired',
] as const;
export type OfferStatusReason = (typeof OFFER_STATUS_REASONS)[number];

export interface Offer {
  id: EntityId;
  requestId: EntityId;
  professionalId: EntityId;
  price: number;
  currency: CurrencyCode;
  /** Proposed appointment start (date + time). */
  proposedStartAt: ISODateTimeString;
  estimatedDurationMinutes: number | null;
  message: string | null;
  status: OfferStatus;
  statusReason: OfferStatusReason | null;
  /** Pending offers expire automatically at this time. */
  expiresAt: ISODateTimeString;
  /** Submission timestamp. */
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
  /** When the customer accepted/rejected it. */
  respondedAt: ISODateTimeString | null;
}

/** Offer enriched with the professional's public summary (customer comparison view). */
export interface OfferWithProfessional extends Offer {
  professional: ProfessionalSummary;
  /** Distance between the professional's base and the request, if known. */
  distanceKm: number | null;
}

/** Offer enriched with its request (professional "My offers" view). */
export interface OfferWithRequest extends Offer {
  request: Pick<
    ServiceRequest,
    'id' | 'categoryId' | 'description' | 'urgency' | 'status' | 'location' | 'preferredSchedule' | 'offerCount' | 'createdAt'
  >;
}
