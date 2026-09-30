import type { CategoryId } from '../catalog/index.js';
import type { CurrencyCode, PreferredTimeWindow, RequestCancellationReason } from '../domain.js';
import type { OfferStatus, RequestStatus } from '../statuses.js';
import type { UrgencyLevel } from '../urgency.js';
import type { EntityId, ISODateString, ISODateTimeString } from './common.js';
import type { ServiceLocation } from './location.js';
import type { CustomerSummary } from './user.js';

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
  offerCount: number;
  pendingOfferCount: number;
  acceptedOfferId: EntityId | null;
  jobId: EntityId | null;
  publishedAt: ISODateTimeString | null;
  cancelledAt: ISODateTimeString | null;
  cancellationReason: RequestCancellationReason | null;
  cancellationComment: string | null;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}

export interface MyOfferSummary {
  offerId: EntityId;
  status: OfferStatus;
  price: number;
  currency: CurrencyCode;
  proposedStartAt: ISODateTimeString;
}

/** A request as seen by a professional (approximate location until hired). */
export interface ProfessionalRequestView extends ServiceRequest {
  distanceKm: number;
  customer: CustomerSummary;
  myOffer: MyOfferSummary | null;
  isMatch: boolean;
}

/** A request as seen by its owner. */
export interface CustomerRequestView extends ServiceRequest {
  latestOfferAt: ISODateTimeString | null;
  lowestOfferPrice: number | null;
  /**
   * Professionals notified when the request was published (their categories and service area cover
   * it); `null` for drafts and for the moment between publishing and the fan-out.
   */
  matchedProfessionalCount: number | null;
}
