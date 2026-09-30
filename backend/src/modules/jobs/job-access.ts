/** Loading jobs for one of their two parties (the mock's `requirePartyJob`). */
import type { ClientSession, Types } from 'mongoose';

import { ApiError } from '../../lib/errors.js';
import type { AuthContext } from '../../middleware/auth.js';
import { JobModel, type JobDoc } from './job.model.js';

function isJobParty(job: Pick<JobDoc, 'customer' | 'professional'>, auth: AuthContext): boolean {
  return auth.role === 'customer' ? job.customer.equals(auth.userId) : job.professional.equals(auth.userId);
}

/** Missing → 404; not the caller's job → 403. */
export async function loadPartyJob(
  auth: AuthContext,
  jobId: Types.ObjectId,
  session?: ClientSession,
  forbiddenMessage = 'You are not a party of this job',
): Promise<JobDoc> {
  const job = await JobModel.findById(jobId).session(session ?? null).lean<JobDoc>();
  if (!job) throw ApiError.notFound('Job');
  if (!isJobParty(job, auth)) throw ApiError.forbidden(forbiddenMessage);
  return job;
}
