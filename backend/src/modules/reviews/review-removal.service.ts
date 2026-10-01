/**
 * The operator's removal of a review (`src/remove-review.ts`: a court order, a review that breaks
 * the Terms; OPERATIONS.md §9). One transaction deletes the review, unlinks it from its job (whose
 * customer may then review it again) and recounts the professional's rating from the remaining
 * reviews, which also drops the cached public profile; both parties get `job.updated`.
 */
import type { Types } from 'mongoose';

import type { AppDeps } from '../../deps.js';
import { withTransaction } from '../../infra/mongo.js';
import { publishJobUpdated } from '../jobs/job-events.js';
import { JobModel, type JobDoc } from '../jobs/job.model.js';
import { recountReviewRatings } from './professional-stats.service.js';
import { ReviewModel, type ReviewDoc } from './review.model.js';

/** The removed review, or `null` when there is none with this id. */
export function removeReview(deps: Pick<AppDeps, 'logger' | 'realtime' | 'cache'>, reviewId: Types.ObjectId): Promise<ReviewDoc | null> {
  return withTransaction(deps.logger, async (tx) => {
    const review = await ReviewModel.findOneAndDelete({ _id: reviewId }, { session: tx.session }).lean<ReviewDoc>();
    if (!review) return null;
    const job = await JobModel.findOneAndUpdate(
      { _id: review.job, review: review._id },
      { $set: { review: null } },
      { session: tx.session, returnDocument: 'after' },
    ).lean<JobDoc>();
    if (job) await publishJobUpdated(deps, job, tx);
    await recountReviewRatings(deps, review.professional, tx);
    return review;
  });
}
