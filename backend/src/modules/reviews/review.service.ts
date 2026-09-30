/**
 * `POST /jobs/:id/review` (the mock's `createReview`): one review per completed job, by its
 * customer. The review, the job's link to it and the professional's rating aggregate are written
 * in one transaction; the professional is notified and both parties get `job.updated`.
 */
import type { ClientSession, Types } from 'mongoose';

import type { AppDeps } from '../../deps.js';
import { withTransaction } from '../../infra/mongo.js';
import { ApiError, isDuplicateKeyError } from '../../lib/errors.js';
import type { AuthContext } from '../../middleware/auth.js';
import { publishJobUpdated } from '../jobs/job-events.js';
import { JobModel, type JobDoc } from '../jobs/job.model.js';
import { createNotification } from '../notifications/create-notification.service.js';
import { customerNameOf } from '../requests/request-access.js';
import { accountGone } from '../users/me.service.js';
import { UserModel } from '../users/user.model.js';
import { recordReviewRating } from './professional-stats.service.js';
import { ReviewModel, type ReviewDoc } from './review.model.js';
import type { CreateReviewInput } from './reviews.schemas.js';

type ReviewDeps = Pick<AppDeps, 'logger' | 'clock' | 'realtime' | 'push' | 'mailer' | 'redis' | 'keys' | 'background' | 'cache'>;

const alreadyReviewed = () => ApiError.conflict('This job was already reviewed');

/** Neither the reviewer's account (its token may outlive it) nor the professional's was deleted. */
async function assertPartiesActive(job: Pick<JobDoc, 'customer' | 'professional'>, session: ClientSession): Promise<void> {
  const deleted = await UserModel.find({ _id: { $in: [job.customer, job.professional] }, deletedAt: { $exists: true } }, { _id: 1 })
    .session(session)
    .lean();
  if (deleted.some((user) => user._id.equals(job.customer))) throw accountGone();
  if (deleted.length > 0) throw ApiError.conflict('The professional deleted their account');
}

export async function createReview(deps: ReviewDeps, auth: AuthContext, jobId: Types.ObjectId, input: CreateReviewInput): Promise<ReviewDoc> {
  try {
    return await withTransaction(deps.logger, async (tx) => {
      const job = await JobModel.findById(jobId).session(tx.session).lean<JobDoc>();
      if (!job) throw ApiError.notFound('Job');
      if (!job.customer.equals(auth.userId)) throw ApiError.forbidden('Only the customer of this job can review it');
      if (job.status !== 'completed') throw ApiError.conflict('Only completed jobs can be reviewed');
      if (job.review !== null) throw alreadyReviewed();
      await assertPartiesActive(job, tx.session);

      const [created] = await ReviewModel.create(
        [{ job: job._id, professional: job.professional, customer: job.customer, categoryId: job.categoryId, rating: input.rating, comment: input.comment }],
        { session: tx.session },
      );
      if (!created) throw new Error('Review was not created');
      const review = created.toObject<ReviewDoc>();
      const linked = await JobModel.findOneAndUpdate(
        { _id: job._id, review: null },
        { $set: { review: review._id } },
        { session: tx.session, returnDocument: 'after' },
      ).lean<JobDoc>();
      if (!linked) throw alreadyReviewed();
      await recordReviewRating(deps, job.professional, review.rating, tx);
      const customerName = await customerNameOf(job.customer, tx.session);
      await createNotification(
        deps,
        job.professional,
        { type: 'review_received', review: { professional: job.professional, categoryId: job.categoryId, rating: review.rating, customerName } },
        tx,
      );
      await publishJobUpdated(deps, linked, tx);
      return review;
    });
  } catch (error) {
    // A double submit races on the unique `reviews.job` index.
    if (isDuplicateKeyError(error)) throw alreadyReviewed();
    throw error;
  }
}
