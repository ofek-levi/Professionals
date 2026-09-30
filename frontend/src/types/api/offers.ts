import type { CurrencyCode, Job, Offer, OfferStatus, ServiceRequest } from '../domain';
import type { PaginationParams } from './common';

/** `POST /requests/:id/offers` */
export interface CreateOfferPayload {
  price: number;
  currency: CurrencyCode;
  /** ISO timestamp of the proposed appointment start. */
  proposedStartAt: string;
  estimatedDurationMinutes: number | null;
  message: string | null;
}

/** `PATCH /offers/:id` – editing is only allowed while `pending`. */
export type UpdateOfferPayload = Partial<CreateOfferPayload>;

export const OFFER_SORTS = ['recommended', 'lowest_price', 'earliest_availability', 'highest_rating', 'most_reviews'] as const;
export type OfferSort = (typeof OFFER_SORTS)[number];

/** `GET /requests/:id/offers` */
export interface RequestOffersParams extends PaginationParams {
  sort?: OfferSort;
  statuses?: OfferStatus[];
}

/** `GET /professional/offers` */
export interface ProfessionalOffersParams extends PaginationParams {
  statuses?: OfferStatus[];
}

/** `POST /offers/:id/accept` */
export interface AcceptOfferResponse {
  offer: Offer;
  request: ServiceRequest;
  job: Job;
}
