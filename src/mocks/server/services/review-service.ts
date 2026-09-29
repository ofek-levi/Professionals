/**
 * Reviews and the statistics derived from them. Professional and customer stats are always
 * recomputed from the source rows (reviews, jobs, offers), never incremented, so they cannot drift.
 */
import { computeRatingBreakdown } from '@/features/reviews/rating';
import { DomainError } from '@/features/shared/domain-error';
import { createReviewSchema } from '@/lib/validation/review';
import type { Paginated, PaginationParams } from '@/types/api';
import type { CustomerProfile, OwnProfessionalProfile, ProfessionalStats, RatingBreakdown, Review } from '@/types/domain';
import { compareIds } from '@/utils/id';

import type { CustomerActor } from '../auth';
import type { ServerContext } from '../context';
import type { MockDatabase } from '../db';
import { paginate } from '../pagination';
import { customerShortName, professionalUserId, requireJob, requireProfessional, requireStoredUser, reviewForJob } from '../queries';
import { parseBody } from '../validate';
import { emitJobUpdated, emitProfileUpdated, notify } from './notification-service';

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Stats implied by the data: reviews → rating, completed jobs → count, offers → response time. */
export function computeProfessionalStats(db: MockDatabase, professionalId: string): ProfessionalStats {
  const breakdown = computeRatingBreakdown(db.reviews.filter((review) => review.professionalId === professionalId));
  const responseTimes: number[] = [];
  for (const offer of db.offers.filter((candidate) => candidate.professionalId === professionalId)) {
    const publishedAt = db.requests.get(offer.requestId)?.publishedAt;
    if (!publishedAt) continue;
    const minutes = (Date.parse(offer.createdAt) - Date.parse(publishedAt)) / 60_000;
    if (minutes >= 0) responseTimes.push(minutes);
  }
  const responseTime = median(responseTimes);
  return {
    averageRating: breakdown.averageRating,
    reviewCount: breakdown.reviewCount,
    completedJobsCount: db.jobs.count((job) => job.professionalId === professionalId && job.status === 'completed'),
    responseTimeMinutes: responseTime === null ? null : Math.max(1, Math.round(responseTime)),
  };
}

export function computeCustomerStats(db: MockDatabase, customerId: string): CustomerProfile['stats'] {
  return {
    requestsCount: db.requests.count((request) => request.customerId === customerId && request.status !== 'draft'),
    completedJobsCount: db.jobs.count((job) => job.customerId === customerId && job.status === 'completed'),
  };
}

const sameStats = (a: object, b: object) => JSON.stringify(a) === JSON.stringify(b);

/** Recomputes and stores a professional's stats; emits `profile.updated` when they changed. */
export function recomputeProfessionalStats(ctx: ServerContext, professionalId: string): OwnProfessionalProfile {
  const professional = requireProfessional(ctx.db, professionalId);
  const stats = computeProfessionalStats(ctx.db, professionalId);
  if (sameStats(stats, professional.stats)) return professional;
  const updated = ctx.db.professionals.update(professionalId, { stats, updatedAt: ctx.nowIso() });
  emitProfileUpdated(ctx, professionalId);
  return updated;
}

export function recomputeCustomerStats(ctx: ServerContext, customerId: string): void {
  const profile = ctx.db.customerProfiles.get(customerId);
  if (!profile) return;
  const stats = computeCustomerStats(ctx.db, customerId);
  if (!sameStats(stats, profile.stats)) ctx.db.customerProfiles.update(customerId, { stats, updatedAt: ctx.nowIso() });
}

/** `POST /jobs/:id/review` – one review per completed job, by its customer. */
export function createReview(ctx: ServerContext, actor: CustomerActor, jobId: string, body: unknown): Review {
  const job = requireJob(ctx.db, jobId);
  if (job.customerId !== actor.userId) throw DomainError.forbidden('Only the customer of this job can review it');
  if (job.status !== 'completed') throw DomainError.conflict('Only completed jobs can be reviewed', 'CONFLICT');
  if (job.reviewId !== null || reviewForJob(ctx.db, job.id)) throw DomainError.conflict('This job was already reviewed');
  const payload = parseBody(createReviewSchema, body);
  const customer = requireStoredUser(ctx.db, actor.userId);
  const now = ctx.nowIso();
  const review = ctx.db.reviews.insert({
    id: ctx.newId('rev'),
    jobId: job.id,
    professionalId: job.professionalId,
    customerId: job.customerId,
    categoryId: job.categoryId,
    rating: payload.rating,
    comment: payload.comment,
    customerDisplayName: customerShortName(customer),
    customerAvatarUrl: customer.avatarUrl,
    createdAt: now,
  });
  const updatedJob = ctx.db.jobs.update(job.id, { reviewId: review.id, updatedAt: now });
  recomputeProfessionalStats(ctx, job.professionalId);
  notify(ctx, professionalUserId(ctx.db, job.professionalId), { type: 'review_received', review });
  emitJobUpdated(ctx, updatedJob);
  return review;
}

/** `GET /professionals/:id/reviews` – newest first, with the full rating breakdown. */
export function listProfessionalReviews(
  ctx: ServerContext,
  professionalId: string,
  params: PaginationParams,
): Paginated<Review> & { breakdown: RatingBreakdown } {
  requireProfessional(ctx.db, professionalId);
  const reviews = ctx.db.reviews
    .filter((review) => review.professionalId === professionalId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || compareIds(b.id, a.id));
  return { ...paginate(reviews, params), breakdown: computeRatingBreakdown(reviews) };
}
