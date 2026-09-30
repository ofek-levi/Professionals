/**
 * Job transitions (the mock's `lifecycle-service.ts`, jobs part): the professional confirms and
 * starts, either party completes; each transition mirrors onto the request, notifies the other
 * party and emits `job.updated` + `request.updated`, all in one transaction. Cancelling happens
 * with the request (the customer's cancel) or when the professional deletes their account.
 */
import type { Types } from 'mongoose';

import type { AppDeps } from '../../deps.js';
import { withTransaction, type Tx } from '../../infra/mongo.js';
import { ApiError } from '../../lib/errors.js';
import type { AuthContext } from '../../middleware/auth.js';
import { REQUEST_STATUS_FOR_JOB_STATUS, type JobStatus } from '../../shared/statuses.js';
import { closeConversation } from '../conversations/conversation-lifecycle.service.js';
import { createNotification } from '../notifications/create-notification.service.js';
import { syncRequestOfferCounters } from '../offers/offer-counters.service.js';
import { customerNameOf, loadRequest, professionalNameOf } from '../requests/request-access.js';
import { publishRequestUpdated } from '../requests/request-events.js';
import { discardAfterCommit, publicIdsOf } from '../requests/request-photos.js';
import { RequestModel, type RequestDoc } from '../requests/request.model.js';
import { assertRequestTransition } from '../requests/request-rules.js';
import { recordCompletedJob } from '../reviews/professional-stats.service.js';
import { loadPartyJob } from './job-access.js';
import { publishJobUpdated } from './job-events.js';
import { JobModel, type JobDoc } from './job.model.js';
import { assertJobTransition } from './job-rules.js';

type LifecycleDeps = Pick<AppDeps, 'logger' | 'clock' | 'realtime' | 'push' | 'mailer' | 'redis' | 'keys' | 'background' | 'cache'>;
type JobPatch = Partial<Pick<JobDoc, 'confirmedAt' | 'startedAt' | 'completedAt' | 'completedBy' | 'cancelledAt'>>;

/** Moves the job to `to` (state machine), mirrors it onto the request and emits both updates. */
async function transitionJob(deps: LifecycleDeps, job: JobDoc, to: JobStatus, patch: JobPatch, tx: Tx): Promise<{ job: JobDoc; request: RequestDoc }> {
  assertJobTransition(job.status, to);
  const request = await loadRequest(job.request, tx.session);
  const requestStatus = REQUEST_STATUS_FOR_JOB_STATUS[to];
  if (request.status !== requestStatus) assertRequestTransition(request.status, requestStatus);
  // Operations of one transaction run one after the other (a session is not safe for parallel use).
  const updatedJob = await JobModel.findOneAndUpdate(
    { _id: job._id, status: job.status },
    { $set: { ...patch, status: to } },
    { session: tx.session, returnDocument: 'after' },
  ).lean<JobDoc>();
  if (!updatedJob) throw ApiError.invalidTransition('job', job.status, to);
  const updatedRequest = await RequestModel.findOneAndUpdate(
    { _id: request._id },
    { $set: { status: requestStatus } },
    { session: tx.session, returnDocument: 'after' },
  ).lean<RequestDoc>();
  if (!updatedRequest) throw ApiError.notFound('Request');
  await publishJobUpdated(deps, updatedJob, tx);
  await publishRequestUpdated(deps, updatedRequest, { tx });
  return { job: updatedJob, request: updatedRequest };
}

async function loadProfessionalJob(auth: AuthContext, jobId: Types.ObjectId, tx: Tx): Promise<JobDoc> {
  const job = await loadPartyJob(auth, jobId, tx.session);
  if (!job.professional.equals(auth.userId)) throw ApiError.forbidden('This job belongs to another professional');
  return job;
}

/** `POST /jobs/:id/confirm` – the professional confirms the appointment. */
export function confirmJob(deps: LifecycleDeps, auth: AuthContext, jobId: Types.ObjectId): Promise<{ job: JobDoc; request: RequestDoc }> {
  return withTransaction(deps.logger, async (tx) => {
    const job = await loadProfessionalJob(auth, jobId, tx);
    const result = await transitionJob(deps, job, 'scheduled', { confirmedAt: deps.clock.now() }, tx);
    const professionalName = await professionalNameOf(job.professional, tx.session);
    await createNotification(deps, job.customer, { type: 'job_confirmed', job: result.job, professionalName }, tx);
    return result;
  });
}

/** `POST /jobs/:id/start` */
export function startJob(deps: LifecycleDeps, auth: AuthContext, jobId: Types.ObjectId): Promise<{ job: JobDoc; request: RequestDoc }> {
  return withTransaction(deps.logger, async (tx) => {
    const job = await loadProfessionalJob(auth, jobId, tx);
    const result = await transitionJob(deps, job, 'in_progress', { startedAt: deps.clock.now() }, tx);
    const professionalName = await professionalNameOf(job.professional, tx.session);
    await createNotification(deps, job.customer, { type: 'job_started', job: result.job, professionalName }, tx);
    return result;
  });
}

/** `POST /jobs/:id/complete` – either party; the other one is notified. */
export function completeJob(deps: LifecycleDeps, auth: AuthContext, jobId: Types.ObjectId): Promise<{ job: JobDoc; request: RequestDoc }> {
  return withTransaction(deps.logger, async (tx) => {
    const job = await loadPartyJob(auth, jobId, tx.session, 'Only the parties of this job can complete it');
    const result = await transitionJob(deps, job, 'completed', { completedAt: deps.clock.now(), completedBy: auth.role }, tx);
    await recordCompletedJob(deps, job.professional, tx);
    if (auth.role === 'professional') {
      const counterpartName = await professionalNameOf(job.professional, tx.session);
      await createNotification(deps, job.customer, { type: 'job_completed', job: result.job, recipientRole: 'customer', counterpartName }, tx);
    } else {
      const counterpartName = await customerNameOf(job.customer, tx.session);
      await createNotification(deps, job.professional, { type: 'job_completed', job: result.job, recipientRole: 'professional', counterpartName }, tx);
    }
    return result;
  });
}

/**
 * Cancels the job of a request being cancelled and closes its chat (part of the request's
 * cancellation transaction; the request itself is updated by the caller).
 */
export async function cancelJobForRequest(deps: Pick<AppDeps, 'realtime'>, job: JobDoc, now: Date, tx: Tx): Promise<JobDoc> {
  assertJobTransition(job.status, 'cancelled');
  const cancelled = await JobModel.findOneAndUpdate(
    { _id: job._id, status: job.status },
    { $set: { status: 'cancelled', cancelledAt: now } },
    { session: tx.session, returnDocument: 'after' },
  ).lean<JobDoc>();
  if (!cancelled) throw ApiError.invalidTransition('job', job.status, 'cancelled');
  await closeConversation(job.conversation, tx.session);
  await publishJobUpdated(deps, cancelled, tx);
  return cancelled;
}

/**
 * The professional deleted their account: the job (any active status: `in_progress` is cancelled
 * only here) and its request are cancelled with reason `account_deleted`, the request's photos
 * deleted as on every cancellation, and the customer is told why (`job_cancelled`).
 */
export async function cancelJobForDeletedProfessional(
  deps: LifecycleDeps & Pick<AppDeps, 'storage'>,
  job: JobDoc,
  now: Date,
  tx: Tx,
): Promise<void> {
  const request = await loadRequest(job.request, tx.session);
  const cancelledJob = await cancelJobForRequest(deps, job, now, tx);
  const cancelled = await syncRequestOfferCounters(request._id, tx, {
    status: 'cancelled',
    cancelledAt: now,
    cancellationReason: 'account_deleted',
    cancellationComment: null,
    photos: [],
  });
  discardAfterCommit(deps, tx, publicIdsOf(request.photos));
  await createNotification(deps, job.customer, { type: 'job_cancelled', job: cancelledJob }, tx);
  await publishRequestUpdated(deps, cancelled, { tx });
}
