/**
 * Professional aggregates maintained on write (the mock's `recomputeProfessionalStats`), each
 * recomputed from its source rows inside the caller's transaction so it can never drift:
 * rating + rank on review creation, completed jobs on completion, response time on offer
 * submission. A change drops the cached public profile and tells the professional's app
 * (`profile.updated`) after commit.
 */
import type { Types } from 'mongoose';

import type { AppDeps } from '../../deps.js';
import type { Tx } from '../../infra/mongo.js';
import { publishEvent } from '../../infra/realtime/index.js';
import { OFFER_STATUSES } from '../../shared/statuses.js';
import { JobModel } from '../jobs/job.model.js';
import { OfferModel } from '../offers/offer.model.js';
import { invalidatePublicProfessionalProfile } from '../professionals/professional-cache.js';
import { bayesianRating } from '../professionals/professional-rank.js';
import { ProfessionalModel } from '../professionals/professional.model.js';
import { RequestModel } from '../requests/request.model.js';
import { ReviewModel } from './review.model.js';

type StatsDeps = Pick<AppDeps, 'realtime' | 'cache'>;

/** Offers sampled for the median response time (bounded work per submission). */
const RESPONSE_TIME_SAMPLE = 100;

/** Sets `stats.<field>` values that differ from the stored ones; notifies when anything changed. */
async function setStats(deps: StatsDeps, professionalId: Types.ObjectId, values: Record<string, number | null>, tx: Tx): Promise<void> {
  const set = Object.fromEntries(Object.entries(values).map(([field, value]) => [`stats.${field}`, value]));
  const differs = Object.entries(set).map(([path, value]) => ({ [path]: { $ne: value } }));
  const result = await ProfessionalModel.updateOne({ _id: professionalId, $or: differs }, { $set: set }, { session: tx.session });
  if (result.modifiedCount === 0) return;
  tx.afterCommit(() => invalidatePublicProfessionalProfile(deps, professionalId));
  await publishEvent(deps.realtime, [professionalId], { type: 'profile.updated', professionalId: professionalId.toHexString() }, tx);
}

/** Average (0.1 precision, like the app), count and the Bayesian search rank. */
export async function refreshRatingStats(deps: StatsDeps, professionalId: Types.ObjectId, tx: Tx): Promise<void> {
  const [row] = await ReviewModel.aggregate<{ sum: number; count: number }>([
    { $match: { professional: professionalId } },
    { $group: { _id: null, sum: { $sum: '$rating' }, count: { $sum: 1 } } },
  ]).session(tx.session);
  const count = row?.count ?? 0;
  const averageRating = row && count > 0 ? Math.round((row.sum / count) * 10) / 10 : null;
  await setStats(deps, professionalId, { averageRating, reviewCount: count, rankScore: bayesianRating(averageRating, count) }, tx);
}

export async function refreshCompletedJobsCount(deps: StatsDeps, professionalId: Types.ObjectId, tx: Tx): Promise<void> {
  const completedJobsCount = await JobModel.countDocuments({ professional: professionalId, status: 'completed' }).session(tx.session);
  await setStats(deps, professionalId, { completedJobsCount }, tx);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? (sorted[middle] ?? null) : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

/**
 * Median minutes from a request's publication to the professional's offer (≥ 1), over their
 * `RESPONSE_TIME_SAMPLE` most recently updated offers.
 */
export async function refreshResponseTime(deps: StatsDeps, professionalId: Types.ObjectId, tx: Tx): Promise<void> {
  // Every status listed so the `{professional, status, updatedAt}` index serves the order.
  const offers = await OfferModel.find({ professional: professionalId, status: { $in: [...OFFER_STATUSES] } }, { request: 1, createdAt: 1 })
    .sort({ updatedAt: -1, _id: -1 })
    .limit(RESPONSE_TIME_SAMPLE)
    .session(tx.session)
    .lean<{ request: Types.ObjectId; createdAt: Date }[]>();
  const requests = await RequestModel.find({ _id: { $in: offers.map((offer) => offer.request) } }, { publishedAt: 1 })
    .session(tx.session)
    .lean<{ _id: Types.ObjectId; publishedAt: Date | null }[]>();
  const publishedAt = new Map(requests.map((request) => [request._id.toHexString(), request.publishedAt]));
  const minutes = offers.flatMap((offer) => {
    const published = publishedAt.get(offer.request.toHexString());
    const value = published ? (offer.createdAt.getTime() - published.getTime()) / 60_000 : -1;
    return value >= 0 ? [value] : [];
  });
  const responseTime = median(minutes);
  await setStats(deps, professionalId, { responseTimeMinutes: responseTime === null ? null : Math.max(1, Math.round(responseTime)) }, tx);
}
