import type { CategoryId } from '../catalog/index.js';
import type { CurrencyCode, UserRole } from '../domain.js';
import type { JobStatus } from '../statuses.js';
import type { EntityId, ISODateTimeString } from './common.js';
import type { ServiceLocation } from './location.js';
import type { ProfessionalSummary } from './professional.js';
import type { ServiceRequest } from './request.js';
import type { Review } from './review.js';
import type { CustomerSummary } from './user.js';

export interface Job {
  id: EntityId;
  requestId: EntityId;
  offerId: EntityId;
  customerId: EntityId;
  professionalId: EntityId;
  conversationId: EntityId;
  categoryId: CategoryId;
  status: JobStatus;
  scheduledStartAt: ISODateTimeString;
  estimatedDurationMinutes: number | null;
  agreedPrice: number;
  currency: CurrencyCode;
  /** Full address – only the two parties see jobs. */
  location: ServiceLocation;
  confirmedAt: ISODateTimeString | null;
  startedAt: ISODateTimeString | null;
  completedAt: ISODateTimeString | null;
  completedBy: UserRole | null;
  cancelledAt: ISODateTimeString | null;
  reviewId: EntityId | null;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}

export interface JobSummary extends Job {
  description: string;
  professional: ProfessionalSummary;
  customer: CustomerSummary;
}

export interface JobDetails extends JobSummary {
  request: ServiceRequest;
  review: Review | null;
  canReview: boolean;
}
