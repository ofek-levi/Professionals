/** Job reads: `GET /jobs?scope=` (keyset pages) and `GET /jobs/:id` (parties only). */
import type { QueryFilter, Types } from 'mongoose';

import type { AppDeps } from '../../deps.js';
import { findPage, type SortSpec } from '../../lib/pagination.js';
import type { AuthContext } from '../../middleware/auth.js';
import type { JobDetails, JobSummary, Paginated } from '../../shared/contract/index.js';
import type { JobScope } from '../../shared/domain.js';
import { ACTIVE_JOB_STATUSES, JOB_STATUSES } from '../../shared/statuses.js';
import { loadPartyJob } from './job-access.js';
import { JobModel, type JobDoc } from './job.model.js';
import type { ListJobsQuery } from './jobs.schemas.js';
import { toJobDetails, toJobSummaries } from './jobs.views.js';

/** Upcoming jobs include appointments that started up to this long ago but were not started yet. */
const UPCOMING_GRACE_MS = 2 * 60 * 60 * 1000;

const SOONEST_FIRST: SortSpec = [
  { path: 'scheduledStartAt', direction: 1 },
  { path: '_id', direction: 1 },
];
const LATEST_APPOINTMENT_FIRST: SortSpec = [
  { path: 'scheduledStartAt', direction: -1 },
  { path: '_id', direction: -1 },
];
const RECENTLY_COMPLETED: SortSpec = [
  { path: 'completedAt', direction: -1 },
  { path: '_id', direction: -1 },
];

/** The caller's side of the job (`customer` or `professional` = their user id). */
function partyFilter(auth: AuthContext): QueryFilter<JobDoc> {
  return auth.role === 'customer' ? { customer: auth.userId } : { professional: auth.userId };
}

function scopeQuery(scope: JobScope, now: Date): { filter: QueryFilter<JobDoc>; sort: SortSpec } {
  switch (scope) {
    case 'active':
      return { filter: { status: { $in: [...ACTIVE_JOB_STATUSES] } }, sort: SOONEST_FIRST };
    case 'upcoming':
      return {
        filter: { status: { $in: ['awaiting_confirmation', 'scheduled'] }, scheduledStartAt: { $gte: new Date(now.getTime() - UPCOMING_GRACE_MS) } },
        sort: SOONEST_FIRST,
      };
    case 'completed':
      return { filter: { status: 'completed' }, sort: RECENTLY_COMPLETED };
    case 'all':
      // Every status listed so the {party, status, scheduledStartAt} index serves the order.
      return { filter: { status: { $in: [...JOB_STATUSES] } }, sort: LATEST_APPOINTMENT_FIRST };
  }
}

export async function listJobs(deps: Pick<AppDeps, 'clock'>, auth: AuthContext, query: ListJobsQuery): Promise<Paginated<JobSummary>> {
  const { filter, sort } = scopeQuery(query.scope, deps.clock.now());
  const page = await findPage<JobDoc, JobDoc>(JobModel, {
    filter: { ...partyFilter(auth), ...filter },
    sort,
    page: { cursor: query.cursor, limit: query.limit },
  });
  return { ...page, items: await toJobSummaries(page.items) };
}

export async function getJobDetails(auth: AuthContext, jobId: Types.ObjectId): Promise<JobDetails> {
  return toJobDetails(await loadPartyJob(auth, jobId), auth);
}
