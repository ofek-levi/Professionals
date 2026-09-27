/** `/jobs/*` routes. */
import { isJobActive } from '@/features/jobs/job-status-machine';
import { DomainError } from '@/features/shared/domain-error';
import { JOB_SCOPES, type JobScope } from '@/types/api';

import type { Actor } from '../auth';
import type { ServerContext } from '../context';
import type { StoredJob } from '../db';
import { requireJob } from '../queries';
import { created, route } from '../router';
import { completeJob, confirmJob, startJob } from '../services/lifecycle-service';
import { createReview } from '../services/review-service';
import { toJob, toJobDetails, toJobSummary } from '../views';

/** Upcoming jobs include appointments that started up to this long ago but were not started yet. */
const UPCOMING_GRACE_MS = 2 * 60 * 60 * 1000;

function isParty(job: StoredJob, actor: Actor): boolean {
  return actor.role === 'customer' ? job.customerId === actor.userId : job.professionalId === actor.professional.id;
}

function requirePartyJob(ctx: ServerContext, actor: Actor, jobId: string): StoredJob {
  const job = requireJob(ctx.db, jobId);
  if (!isParty(job, actor)) throw DomainError.forbidden('You are not a party of this job');
  return job;
}

function listJobs(ctx: ServerContext, actor: Actor, scope: JobScope) {
  const now = ctx.now().getTime();
  const start = (job: StoredJob) => Date.parse(job.scheduledStartAt);
  const finished = (job: StoredJob) => Date.parse(job.completedAt ?? job.cancelledAt ?? job.updatedAt);
  const jobs = ctx.db.jobs.filter((job) => isParty(job, actor));
  let selected: StoredJob[];
  switch (scope) {
    case 'active':
      selected = jobs.filter((job) => isJobActive(job.status)).sort((a, b) => start(a) - start(b));
      break;
    case 'upcoming':
      selected = jobs
        .filter(
          (job) => (job.status === 'awaiting_confirmation' || job.status === 'scheduled') && start(job) >= now - UPCOMING_GRACE_MS,
        )
        .sort((a, b) => start(a) - start(b));
      break;
    case 'completed':
      selected = jobs.filter((job) => job.status === 'completed').sort((a, b) => finished(b) - finished(a));
      break;
    case 'all':
      selected = jobs.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || b.id.localeCompare(a.id));
      break;
  }
  return selected.map((job) => toJobSummary(ctx, job));
}

export const jobRoutes = [
  route({
    method: 'GET',
    path: '/jobs',
    auth: 'user',
    handler: ({ ctx, actor, query }) => listJobs(ctx, actor, query.enumValue('scope', JOB_SCOPES) ?? 'all'),
  }),
  route({
    method: 'GET',
    path: '/jobs/:jobId',
    auth: 'user',
    handler: ({ ctx, actor, params }) => toJobDetails(ctx, requirePartyJob(ctx, actor, params.jobId), actor),
  }),
  route({
    method: 'POST',
    path: '/jobs/:jobId/confirm',
    auth: 'professional',
    handler: ({ ctx, actor, params }) => toJob(confirmJob(ctx, actor, params.jobId)),
  }),
  route({
    method: 'POST',
    path: '/jobs/:jobId/start',
    auth: 'professional',
    handler: ({ ctx, actor, params }) => toJob(startJob(ctx, actor, params.jobId)),
  }),
  route({
    method: 'POST',
    path: '/jobs/:jobId/complete',
    auth: 'user',
    handler: ({ ctx, actor, params }) => toJob(completeJob(ctx, actor, params.jobId)),
  }),
  route({
    method: 'POST',
    path: '/jobs/:jobId/review',
    auth: 'customer',
    handler: ({ ctx, actor, params, body }) => created(createReview(ctx, actor, params.jobId, body)),
  }),
];
