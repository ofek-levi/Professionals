/**
 * Professional aggregates maintained on write (the mock's `recomputeProfessionalStats`):
 * - rating: the review's star is counted in `stats.ratingCounts` inside the review transaction and
 *   the average, count and search rank are derived from those counts (users only ever create
 *   reviews, so the counts cannot drift, and no review is re-read); when the operator removes a
 *   review (`review-removal.service.ts`) the counts are recounted from the remaining reviews;
 * - completed jobs: incremented inside the completion transaction (`completed` is terminal and the
 *   transition is a conditional write, so each job counts exactly once);
 * - response time: a sampled median recomputed after the offer committed. It is a derived
 *   statistic, and recomputing it inside the offer transaction made the professional document a
 *   write-conflict hot spot (two offers submitted at once retried each other's transaction).
 * A change drops the cached public profile and tells the professional's app (`profile.updated`).
 */
import type { Types } from 'mongoose';

import type { AppDeps } from '../../deps.js';
import type { Tx } from '../../infra/mongo.js';
import { publishEvent } from '../../infra/realtime/index.js';
import { RECENTLY_UPDATED, sortOf } from '../../lib/pagination.js';
import type { Rating } from '../../shared/domain.js';
import { OFFER_STATUSES } from '../../shared/statuses.js';
import { OfferModel } from '../offers/offer.model.js';
import { invalidatePublicProfessionalProfile } from '../professionals/professional-cache.js';
import { bayesianRating, emptyRatingCounts, ratingBreakdown } from '../professionals/professional-rank.js';
import { ProfessionalModel, type ProfessionalDoc } from '../professionals/professional.model.js';
import { RequestModel } from '../requests/request.model.js';
import { ReviewModel } from './review.model.js';

type StatsDeps = Pick<AppDeps, 'realtime' | 'cache'>;

/** Offers sampled for the median response time (bounded work per submission). */
const RESPONSE_TIME_SAMPLE = 100;

/** After a stats change: drop the cached public profile and notify the professional's app. */
async function statsChanged(deps: StatsDeps, professionalId: Types.ObjectId, tx: Tx | undefined): Promise<void> {
  if (tx) tx.afterCommit(() => invalidatePublicProfessionalProfile(deps, professionalId));
  else await invalidatePublicProfessionalProfile(deps, professionalId);
  await publishEvent(deps.realtime, [professionalId], { type: 'profile.updated', professionalId: professionalId.toHexString() }, tx);
}

/** Sets `stats.<field>` values that differ from the stored ones; notifies when anything changed. */
async function setStats(deps: StatsDeps, professionalId: Types.ObjectId, values: Record<string, number | number[] | null>, tx?: Tx): Promise<void> {
  const set = Object.fromEntries(Object.entries(values).map(([field, value]) => [`stats.${field}`, value]));
  const differs = Object.entries(set).map(([path, value]) => ({ [path]: { $ne: value } }));
  const result = await ProfessionalModel.updateOne({ _id: professionalId, $or: differs }, { $set: set }, { session: tx?.session });
  if (result.modifiedCount > 0) await statsChanged(deps, professionalId, tx);
}

/** Counts a new review's rating and derives the average (0.1 precision), count and search rank. */
export async function recordReviewRating(deps: StatsDeps, professionalId: Types.ObjectId, rating: Rating, tx?: Tx): Promise<void> {
  const counted = await ProfessionalModel.findOneAndUpdate(
    { _id: professionalId },
    { $inc: { [`stats.ratingCounts.${rating - 1}`]: 1 } },
    { session: tx?.session, returnDocument: 'after', projection: { 'stats.ratingCounts': 1 } },
  ).lean<{ stats: Pick<ProfessionalDoc['stats'], 'ratingCounts'> }>();
  if (!counted) throw new Error(`Professional ${professionalId.toHexString()} not found for a review`);
  const { averageRating, reviewCount } = ratingBreakdown(counted.stats.ratingCounts);
  await setStats(deps, professionalId, { averageRating, reviewCount, rankScore: bayesianRating(averageRating, reviewCount) }, tx);
}

/** Recounts the ratings from the professional's reviews (one was removed) and derives the rest as above. */
export async function recountReviewRatings(deps: StatsDeps, professionalId: Types.ObjectId, tx: Tx): Promise<void> {
  const counts = await ReviewModel.aggregate<{ _id: Rating; count: number }>([
    { $match: { professional: professionalId } },
    { $group: { _id: '$rating', count: { $sum: 1 } } },
  ]).session(tx.session);
  const ratingCounts = emptyRatingCounts();
  for (const { _id: rating, count } of counts) ratingCounts[rating - 1] = count;
  const { averageRating, reviewCount } = ratingBreakdown(ratingCounts);
  await setStats(deps, professionalId, { ratingCounts, averageRating, reviewCount, rankScore: bayesianRating(averageRating, reviewCount) }, tx);
}

/** One more completed job (called once per job, in its completion transaction). */
export async function recordCompletedJob(deps: StatsDeps, professionalId: Types.ObjectId, tx: Tx): Promise<void> {
  await ProfessionalModel.updateOne({ _id: professionalId }, { $inc: { 'stats.completedJobsCount': 1 } }, { session: tx.session });
  await statsChanged(deps, professionalId, tx);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? (sorted[middle] ?? null) : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

/**
 * Median minutes from a request's publication to the professional's offer (≥ 1), over their
 * `RESPONSE_TIME_SAMPLE` most recently updated offers. Runs outside any transaction (see above).
 */
export async function refreshResponseTime(deps: StatsDeps, professionalId: Types.ObjectId): Promise<void> {
  // Every status listed so the `{professional, status, updatedAt}` index serves the order.
  const offers = await OfferModel.find({ professional: professionalId, status: { $in: [...OFFER_STATUSES] } }, { request: 1, createdAt: 1 })
    .sort(sortOf(RECENTLY_UPDATED))
    .limit(RESPONSE_TIME_SAMPLE)
    .lean<{ request: Types.ObjectId; createdAt: Date }[]>();
  const requests = await RequestModel.find({ _id: { $in: offers.map((offer) => offer.request) } }, { publishedAt: 1 }).lean<
    { _id: Types.ObjectId; publishedAt: Date | null }[]
  >();
  const publishedAt = new Map(requests.map((request) => [request._id.toHexString(), request.publishedAt]));
  const minutes = offers.flatMap((offer) => {
    const published = publishedAt.get(offer.request.toHexString());
    const value = published ? (offer.createdAt.getTime() - published.getTime()) / 60_000 : -1;
    return value >= 0 ? [value] : [];
  });
  const responseTime = median(minutes);
  await setStats(deps, professionalId, { responseTimeMinutes: responseTime === null ? null : Math.max(1, Math.round(responseTime)) });
}
