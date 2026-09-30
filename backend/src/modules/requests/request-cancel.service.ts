/**
 * Cancelling a request (the mock's `cancelRequest`): in one transaction the pending offers are
 * rejected, an assigned job is cancelled (its chat closed) and the request is cancelled; every
 * affected professional is notified and the explorers of matching professionals drop it. Its
 * photos are removed from the request and deleted from storage after the commit. The customer
 * does it with `POST /requests/:id/cancel` (until the work starts); account deletion reuses the
 * core (`cancelRequestInTx`) for every active request of the deleted customer.
 */
import type { Types } from 'mongoose';

import type { AppDeps } from '../../deps.js';
import { withTransaction, type Tx } from '../../infra/mongo.js';
import { uniqueIds } from '../../lib/ids.js';
import type { RequestCancellationReason } from '../../shared/domain.js';
import { requestAcceptsOffers } from '../../shared/statuses.js';
import type { AuthContext } from '../../middleware/auth.js';
import { cancelJobForRequest } from '../jobs/job-lifecycle.service.js';
import { JobModel, type JobDoc } from '../jobs/job.model.js';
import { assertJobTransition } from '../jobs/job-rules.js';
import { createNotifications } from '../notifications/create-notification.service.js';
import { rejectPendingOffers, syncRequestOfferCounters } from '../offers/offer-counters.service.js';
import { publishOfferUpdated } from '../offers/offer-events.js';
import { customerNameOf, loadOwnedRequest } from './request-access.js';
import { publishRequestLeftExplorers, publishRequestUpdated } from './request-events.js';
import { discardAfterCommit, publicIdsOf } from './request-photos.js';
import { assertCustomerCanCancel, assertRequestTransition } from './request-rules.js';
import type { RequestDoc } from './request.model.js';
import type { CancelRequestInput } from './requests.schemas.js';

export type CancelDeps = Pick<AppDeps, 'env' | 'logger' | 'clock' | 'realtime' | 'push' | 'mailer' | 'redis' | 'keys' | 'background' | 'storage'>;

export interface RequestCancellation {
  reason: RequestCancellationReason;
  comment: string | null;
  /** How the notified professionals see the customer (`''` for a deleted account: "A customer"). */
  customerName: string;
}

/** `POST /requests/:id/cancel` */
export function cancelRequest(deps: CancelDeps, auth: AuthContext, requestId: Types.ObjectId, input: CancelRequestInput): Promise<RequestDoc> {
  return withTransaction(deps.logger, async (tx) => {
    const request = await loadOwnedRequest(auth, requestId, tx.session);
    assertCustomerCanCancel(request.status);
    const customerName = await customerNameOf(request.customer, tx.session);
    return cancelRequestInTx(deps, request, { reason: input.reason, comment: input.comment, customerName }, tx);
  });
}

/** Cancels `request` (read in `tx`) and everything hanging on it; the caller decided it may. */
export async function cancelRequestInTx(deps: CancelDeps, request: RequestDoc, cancellation: RequestCancellation, tx: Tx): Promise<RequestDoc> {
  assertRequestTransition(request.status, 'cancelled');
  const job = request.job ? await JobModel.findById(request.job).session(tx.session).lean<JobDoc>() : null;
  const jobToCancel = job && job.status !== 'cancelled' ? job : null;
  if (jobToCancel) assertJobTransition(jobToCancel.status, 'cancelled');

  const now = deps.clock.now();
  const rejected = await rejectPendingOffers(request._id, 'request_cancelled', now, tx);
  const cancelledJob = jobToCancel ? await cancelJobForRequest(deps, jobToCancel, now, tx) : null;
  const cancelled = await syncRequestOfferCounters(request._id, tx, {
    status: 'cancelled',
    cancelledAt: now,
    cancellationReason: cancellation.reason,
    cancellationComment: cancellation.comment,
    photos: [],
  });
  discardAfterCommit(deps, tx, publicIdsOf(request.photos));

  const affected = uniqueIds([...rejected.map((offer) => offer.professional), cancelledJob?.professional]);
  await createNotifications(
    deps,
    affected.map((professionalId) => ({
      userId: professionalId,
      input: { type: 'request_cancelled', request: cancelled, customerName: cancellation.customerName },
    })),
    tx,
  );
  for (const offer of rejected) await publishOfferUpdated(deps, offer, cancelled.customer, tx);
  // While it took offers it was on the explorers of matching professionals: they drop it too.
  if (requestAcceptsOffers(request.status)) publishRequestLeftExplorers(deps, cancelled, tx);
  else await publishRequestUpdated(deps, cancelled, { tx });
  return cancelled;
}
