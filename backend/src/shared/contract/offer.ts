import type { CurrencyCode } from '../domain.js';
import type { OfferStatus, OfferStatusReason } from '../statuses.js';
import type { EntityId, ISODateTimeString } from './common.js';
import type { ProfessionalSummary } from './professional.js';
import type { ServiceRequest } from './request.js';

export interface Offer {
  id: EntityId;
  requestId: EntityId;
  professionalId: EntityId;
  price: number;
  currency: CurrencyCode;
  proposedStartAt: ISODateTimeString;
  estimatedDurationMinutes: number | null;
  message: string | null;
  status: OfferStatus;
  statusReason: OfferStatusReason | null;
  expiresAt: ISODateTimeString;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
  respondedAt: ISODateTimeString | null;
}

export interface OfferWithProfessional extends Offer {
  professional: ProfessionalSummary;
  distanceKm: number | null;
}

export type OfferRequestSummary = Pick<
  ServiceRequest,
  | 'id'
  | 'categoryId'
  | 'description'
  | 'urgency'
  | 'status'
  | 'location'
  | 'preferredSchedule'
  | 'offerCount'
  | 'pendingOfferCount'
  | 'createdAt'
>;

export interface OfferWithRequest extends Offer {
  request: OfferRequestSummary;
}

/** `GET /offers/:id` */
export type OfferDetails = OfferWithProfessional & { request: OfferRequestSummary };
