/** Thin job controllers: validate → service → view. */
import type { Request } from 'express';

import type { AppDeps } from '../../deps.js';
import { parseObjectId } from '../../lib/ids.js';
import { validateRequest } from '../../lib/validate.js';
import { authOf } from '../../middleware/auth.js';
import { completeJob, confirmJob, startJob } from './job-lifecycle.service.js';
import { getJobDetails, listJobs } from './job-queries.service.js';
import { jobParams, listJobsQuery } from './jobs.schemas.js';
import { toJobDto } from './jobs.views.js';

const jobIdOf = (req: Request) => parseObjectId(validateRequest(req, { params: jobParams }).params.jobId, 'Job');

/** `GET /v1/jobs?scope=&cursor=&limit=` → `Paginated<JobSummary>` */
export const list = (deps: AppDeps) => (req: Request) => {
  const { query } = validateRequest(req, { query: listJobsQuery });
  return listJobs(deps, authOf(req), query);
};

/** `GET /v1/jobs/:jobId` → `JobDetails` */
export const getDetails = () => (req: Request) => getJobDetails(authOf(req), jobIdOf(req));

/** `POST /v1/jobs/:jobId/confirm` → `Job` */
export const confirm = (deps: AppDeps) => async (req: Request) => {
  const { job, request } = await confirmJob(deps, authOf(req, 'professional'), jobIdOf(req));
  return toJobDto(job, request);
};

/** `POST /v1/jobs/:jobId/start` → `Job` */
export const start = (deps: AppDeps) => async (req: Request) => {
  const { job, request } = await startJob(deps, authOf(req, 'professional'), jobIdOf(req));
  return toJobDto(job, request);
};

/** `POST /v1/jobs/:jobId/complete` → `Job` */
export const complete = (deps: AppDeps) => async (req: Request) => {
  const { job, request } = await completeJob(deps, authOf(req), jobIdOf(req));
  return toJobDto(job, request);
};
