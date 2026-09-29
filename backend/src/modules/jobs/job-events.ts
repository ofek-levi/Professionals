/** `job.updated` realtime events: both parties of the job. */
import type { AppDeps } from '../../deps.js';
import type { Tx } from '../../infra/mongo.js';
import { publishEvent } from '../../infra/realtime/index.js';
import type { JobDoc } from './job.model.js';

export async function publishJobUpdated(
  deps: Pick<AppDeps, 'realtime'>,
  job: Pick<JobDoc, '_id' | 'request' | 'customer' | 'professional'>,
  tx?: Tx,
): Promise<void> {
  const event = { type: 'job.updated', jobId: job._id.toHexString(), requestId: job.request.toHexString() } as const;
  await publishEvent(deps.realtime, [job.customer, job.professional], event, tx);
}
