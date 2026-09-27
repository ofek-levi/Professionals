import type { CurrencyCode, EntityId, ISODateTimeString } from './common';
import type { CategoryId } from './category';
import type { ServiceLocation } from './location';
import type { ProfessionalSummary } from './professional';
import type { ServiceRequest } from './request';
import type { Review } from './review';
import type { CustomerSummary, UserRole } from './user';
import type { JobStatus } from '@/constants/job-statuses';

export type { JobStatus };

/**
 * A job is created when a customer accepts an offer. It tracks the execution of the work,
 * while the request keeps the marketplace-level status.
 */
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
  /** Full address – only visible to the two parties of the job. */
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
  /** Whether the current user may leave a review for this job. */
  canReview: boolean;
}
