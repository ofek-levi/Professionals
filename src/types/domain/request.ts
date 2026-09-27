import type { CurrencyCode, EntityId, ISODateString, ISODateTimeString } from './common';
import type { CategoryId } from './category';
import type { ServiceLocation } from './location';
import type { CustomerSummary } from './user';
import type { OfferStatus } from '@/constants/offer-statuses';
import type { RequestStatus } from '@/constants/request-statuses';
import type { UrgencyLevel } from '@/constants/urgency-levels';

export type { RequestStatus, UrgencyLevel };

export const PREFERRED_TIME_WINDOWS = ['morning', 'afternoon', 'evening', 'any'] as const;
export type PreferredTimeWindow = (typeof PREFERRED_TIME_WINDOWS)[number];

/**
 * When the customer would like the appointment to happen.
 * Deliberately separate from `urgency` (how quickly the problem must be handled).
 */
export interface PreferredSchedule {
  date: ISODateString;
  timeWindow: PreferredTimeWindow;
}

export interface RequestPhoto {
  id: EntityId;
  url: string;
  width: number | null;
  height: number | null;
}

export const REQUEST_CANCELLATION_REASONS = [
  'no_longer_needed',
  'found_elsewhere',
  'too_expensive',
  'scheduling_conflict',
  'other',
] as const;
export type RequestCancellationReason = (typeof REQUEST_CANCELLATION_REASONS)[number];

export interface ServiceRequest {
  id: EntityId;
  customerId: EntityId;
  categoryId: CategoryId;
  description: string;
  location: ServiceLocation;
  urgency: UrgencyLevel;
  preferredSchedule: PreferredSchedule | null;
  photos: RequestPhoto[];
  notes: string | null;
  status: RequestStatus;
  /**
   * Offers received that were not withdrawn (history: includes rejected and expired ones). Shown to
   * the owner; professionals compete with `pendingOfferCount`.
   */
  offerCount: number;
  /**
   * Live offers still awaiting the customer's decision. This is the competition professionals see
   * (explorer filters/sorting, "Be the first", offer counts on their cards).
   */
  pendingOfferCount: number;
  acceptedOfferId: EntityId | null;
  jobId: EntityId | null;
  publishedAt: ISODateTimeString | null;
  cancelledAt: ISODateTimeString | null;
  cancellationReason: RequestCancellationReason | null;
  /** Optional note the customer left for the professionals when cancelling. */
  cancellationComment: string | null;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}

/** Offer summary a professional sees about their own offer on a request. */
export interface MyOfferSummary {
  offerId: EntityId;
  status: OfferStatus;
  price: number;
  currency: CurrencyCode;
  proposedStartAt: ISODateTimeString;
}

/**
 * A request as seen by a professional browsing jobs.
 * The location is approximate until the professional's offer is accepted.
 */
export interface ProfessionalRequestView extends ServiceRequest {
  distanceKm: number;
  customer: CustomerSummary;
  myOffer: MyOfferSummary | null;
  /** True when the request matches the professional's categories and service area. */
  isMatch: boolean;
}

/** A request as seen by its owner (customer). */
export interface CustomerRequestView extends ServiceRequest {
  /** Newest pending offer timestamp, used for "new offers" highlights. */
  latestOfferAt: ISODateTimeString | null;
  /** Lowest pending/accepted offer price, if any. */
  lowestOfferPrice: number | null;
}
