/**
 * What deleting an account changes, read by one set of queries shared by the preview
 * (`GET /me/deletion-impact`) and the deletion itself (inside its transaction, so it acts on
 * exactly what it read):
 * - customer: unpublished drafts (deleted), requests taking offers or with an active job
 *   (cancelled, their pending offers declined), the active jobs (cancelled with their requests);
 * - professional: every pending offer, overdue ones included (withdrawn), the active jobs
 *   (cancelled with their requests).
 */
import type { ClientSession, Types } from 'mongoose';

import { ACTIVE_JOB_STATUSES, type RequestStatus } from '../../shared/statuses.js';
import type { UserRole } from '../../shared/domain.js';
import { JobModel, type JobDoc } from '../jobs/job.model.js';
import { OfferModel, type OfferDoc } from '../offers/offer.model.js';
import { RequestModel, type RequestDoc } from '../requests/request.model.js';

/** Requests past draft that are not finished: taking offers, or with an active job. */
const CANCELLABLE_REQUEST_STATUSES: RequestStatus[] = ['open', 'offers_received', 'professional_selected', 'scheduled', 'in_progress'];

export type DeletionImpact =
  | { role: 'customer'; drafts: RequestDoc[]; requests: RequestDoc[]; jobs: JobDoc[] }
  | { role: 'professional'; offers: OfferDoc[]; jobs: JobDoc[] };

/** Soonest first (`{customer|professional, status, scheduledStartAt, _id}` indexes). */
function activeJobs(party: 'customer' | 'professional', userId: Types.ObjectId, session: ClientSession | null): Promise<JobDoc[]> {
  return JobModel.find({ [party]: userId, status: { $in: [...ACTIVE_JOB_STATUSES] } })
    .sort({ scheduledStartAt: 1, _id: 1 })
    .session(session)
    .lean<JobDoc[]>();
}

export async function collectDeletionImpact(user: { _id: Types.ObjectId; role: UserRole }, session?: ClientSession): Promise<DeletionImpact> {
  const tx = session ?? null;
  // One after the other: a transaction's session is not safe for parallel use.
  if (user.role === 'customer') {
    const drafts = await RequestModel.find({ customer: user._id, status: 'draft' }).session(tx).lean<RequestDoc[]>();
    const requests = await RequestModel.find({ customer: user._id, status: { $in: CANCELLABLE_REQUEST_STATUSES } })
      .sort({ createdAt: -1 })
      .session(tx)
      .lean<RequestDoc[]>();
    return { role: 'customer', drafts, requests, jobs: await activeJobs('customer', user._id, tx) };
  }
  const offers = await OfferModel.find({ professional: user._id, status: 'pending' }).sort({ updatedAt: -1, _id: -1 }).session(tx).lean<OfferDoc[]>();
  return { role: 'professional', offers, jobs: await activeJobs('professional', user._id, tx) };
}
