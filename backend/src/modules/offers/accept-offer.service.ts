/**
 * `POST /offers/:id/accept` (the mock's `acceptOffer`). One MongoDB transaction accepts the offer,
 * rejects every other pending offer, creates the job and its conversation and moves the request to
 * `professional_selected`. Concurrency: every step is a conditional write on documents a competing
 * acceptance also writes (the request above all), so the loser hits a write conflict, is retried
 * by the driver, re-reads the request and fails with 409; the unique `jobs.request` index is the
 * last line of defence.
 */
import type { Types } from 'mongoose';

import type { AppDeps } from '../../deps.js';
import { withTransaction } from '../../infra/mongo.js';
import { ApiError, isDuplicateKeyError } from '../../lib/errors.js';
import { newObjectId } from '../../lib/ids.js';
import type { AuthContext } from '../../middleware/auth.js';
import { REQUEST_STATUS_FOR_JOB_STATUS } from '../../shared/statuses.js';
import { ensureConversationForJob } from '../conversations/conversation-lifecycle.service.js';
import { publishJobUpdated } from '../jobs/job-events.js';
import { JobModel, type JobDoc } from '../jobs/job.model.js';
import { createNotifications } from '../notifications/create-notification.service.js';
import { customerNameOf, loadOwnedRequest } from '../requests/request-access.js';
import { publishRequestLeftExplorers } from '../requests/request-events.js';
import type { RequestDoc } from '../requests/request.model.js';
import { assertRequestTransition } from '../requests/request-rules.js';
import { rejectPendingOffers, syncRequestOfferCounters } from './offer-counters.service.js';
import { publishOfferUpdated } from './offer-events.js';
import { assertOfferAcceptable, assertOfferTransition } from './offer-rules.js';
import { OfferModel, type OfferDoc } from './offer.model.js';

type AcceptDeps = Pick<AppDeps, 'env' | 'logger' | 'clock' | 'realtime' | 'push' | 'mailer' | 'redis' | 'keys' | 'background'>;

export interface AcceptedOffer {
  offer: OfferDoc;
  request: RequestDoc;
  job: JobDoc;
}

const alreadyAccepted = () => ApiError.conflict('An offer has already been accepted for this request');

export async function acceptOffer(deps: AcceptDeps, auth: AuthContext, offerId: Types.ObjectId): Promise<AcceptedOffer> {
  try {
    return await withTransaction(deps.logger, async (tx) => {
      const offer = await OfferModel.findById(offerId).session(tx.session).lean<OfferDoc>();
      if (!offer) throw ApiError.notFound('Offer');
      const request = await loadOwnedRequest(auth, offer.request, tx.session);
      const now = deps.clock.now();
      assertOfferAcceptable(offer, request, now);
      assertOfferTransition(offer.status, 'accepted');
      assertRequestTransition(request.status, REQUEST_STATUS_FOR_JOB_STATUS.awaiting_confirmation);

      const accepted = await OfferModel.findOneAndUpdate(
        { _id: offer._id, status: 'pending' },
        { $set: { status: 'accepted', statusReason: 'accepted_by_customer', respondedAt: now } },
        { session: tx.session, returnDocument: 'after' },
      ).lean<OfferDoc>();
      if (!accepted) throw alreadyAccepted();
      const rejected = await rejectPendingOffers(request._id, 'another_offer_accepted', now, tx);

      const jobId = newObjectId();
      const conversation = await ensureConversationForJob(
        { jobId, requestId: request._id, categoryId: request.categoryId, customerUserId: request.customer, professionalUserId: accepted.professional, now },
        tx.session,
      );
      const [createdJob] = await JobModel.create(
        [
          {
            _id: jobId,
            request: request._id,
            offer: accepted._id,
            customer: request.customer,
            professional: accepted.professional,
            conversation,
            categoryId: request.categoryId,
            status: 'awaiting_confirmation',
            scheduledStartAt: accepted.proposedStartAt,
            estimatedDurationMinutes: accepted.estimatedDurationMinutes,
            agreedPrice: accepted.price,
            currency: accepted.currency,
          },
        ],
        { session: tx.session },
      );
      if (!createdJob) throw new Error('Job was not created');
      const job = createdJob.toObject<JobDoc>();
      const updatedRequest = await syncRequestOfferCounters(request._id, tx, {
        status: REQUEST_STATUS_FOR_JOB_STATUS.awaiting_confirmation,
        acceptedOffer: accepted._id,
        job: job._id,
      });

      const customerName = await customerNameOf(request.customer, tx.session);
      await createNotifications(
        deps,
        [
          { userId: accepted.professional, input: { type: 'offer_accepted', offer: accepted, job, customerName } },
          ...rejected.map((other) => ({
            userId: other.professional,
            input: { type: 'offer_not_selected' as const, offer: other, categoryId: request.categoryId, customerName },
          })),
        ],
        tx,
      );
      for (const changed of [accepted, ...rejected]) await publishOfferUpdated(deps, changed, request.customer, tx);
      // It took offers until now, so it leaves the explorers of every matching professional.
      publishRequestLeftExplorers(deps, updatedRequest, tx);
      await publishJobUpdated(deps, job, tx);
      return { offer: accepted, request: updatedRequest, job };
    });
  } catch (error) {
    // A competing acceptance that slipped past the checks trips the unique job-per-request index.
    if (isDuplicateKeyError(error)) throw alreadyAccepted();
    throw error;
  }
}
