/**
 * Job DTOs (the mock's `views.ts`, jobs part). Only the two parties see a job, so the address is
 * the request's exact location; summaries batch-load requests, professionals and customers.
 */
import type { Types } from 'mongoose';

import { toServiceLocation } from '../../infra/schema-parts.js';
import { loadByIds, required } from '../../lib/batch.js';
import { isoOrNull } from '../../lib/clock.js';
import type { AuthContext } from '../../middleware/auth.js';
import type { CustomerSummary, Job, JobDetails, JobSummary, ProfessionalSummary } from '../../shared/contract/index.js';
import { loadCustomerSummaries } from '../customers/customer-summary.views.js';
import { loadProfessionalSummaries } from '../professionals/professional.views.js';
import { toReviewDtos } from '../professionals/review-list.views.js';
import { RequestModel, type RequestDoc } from '../requests/request.model.js';
import { toServiceRequestDto } from '../requests/requests.views.js';
import { ReviewModel, type ReviewDoc } from '../reviews/review.model.js';
import type { JobDoc } from './job.model.js';


export function toJobDto(job: JobDoc, request: Pick<RequestDoc, 'location'>): Job {
  return {
    id: job._id.toHexString(),
    requestId: job.request.toHexString(),
    offerId: job.offer.toHexString(),
    customerId: job.customer.toHexString(),
    professionalId: job.professional.toHexString(),
    conversationId: job.conversation.toHexString(),
    categoryId: job.categoryId,
    status: job.status,
    scheduledStartAt: job.scheduledStartAt.toISOString(),
    estimatedDurationMinutes: job.estimatedDurationMinutes,
    agreedPrice: job.agreedPrice,
    currency: job.currency,
    location: toServiceLocation(request.location),
    confirmedAt: isoOrNull(job.confirmedAt),
    startedAt: isoOrNull(job.startedAt),
    completedAt: isoOrNull(job.completedAt),
    completedBy: job.completedBy,
    cancelledAt: isoOrNull(job.cancelledAt),
    reviewId: job.review ? job.review.toHexString() : null,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

type SummaryRequest = Pick<RequestDoc, '_id' | 'location' | 'description'>;

function toJobSummary(job: JobDoc, request: SummaryRequest, professional: ProfessionalSummary, customer: CustomerSummary): JobSummary {
  return { ...toJobDto(job, request), description: request.description, professional, customer };
}

/** Summaries of a page of jobs: requests, professionals and customers loaded once each. */
export async function toJobSummaries(jobs: JobDoc[]): Promise<JobSummary[]> {
  const ids = (pick: (job: JobDoc) => Types.ObjectId) => jobs.map(pick);
  const [requests, professionals, customers] = await Promise.all([
    loadByIds<RequestDoc, SummaryRequest>(RequestModel, ids((job) => job.request), { location: 1, description: 1 }),
    loadProfessionalSummaries(ids((job) => job.professional)),
    loadCustomerSummaries(ids((job) => job.customer)),
  ]);
  return jobs.map((job) =>
    toJobSummary(
      job,
      required(requests, job.request, 'Request'),
      required(professionals, job.professional, 'Professional'),
      required(customers, job.customer, 'Customer'),
    ),
  );
}

/** `GET /jobs/:id`: the summary plus the full request, the review and whether the viewer can review. */
export async function toJobDetails(job: JobDoc, viewer: AuthContext): Promise<JobDetails> {
  const [request, review, professionals, customers] = await Promise.all([
    RequestModel.findById(job.request).lean<RequestDoc>(),
    ReviewModel.findOne({ job: job._id }).lean<ReviewDoc>(),
    loadProfessionalSummaries([job.professional]),
    loadCustomerSummaries([job.customer]),
  ]);
  if (!request) throw new Error(`Job ${job._id.toHexString()} has no request`);
  const [reviewDto] = review ? await toReviewDtos([review]) : [];
  return {
    ...toJobSummary(job, request, required(professionals, job.professional, 'Professional'), required(customers, job.customer, 'Customer')),
    request: toServiceRequestDto(request),
    review: reviewDto ?? null,
    canReview: viewer.role === 'customer' && job.customer.equals(viewer.userId) && job.status === 'completed' && review === null,
  };
}
