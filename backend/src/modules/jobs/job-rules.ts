/**
 * Job status machine (the app's `features/jobs/job-status-machine.ts`). A job's status mirrors onto
 * its request (`REQUEST_STATUS_FOR_JOB_STATUS`).
 */
import { ApiError } from '../../lib/errors.js';
import type { JobStatus } from '../../shared/statuses.js';

const JOB_TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  awaiting_confirmation: ['scheduled', 'cancelled'],
  scheduled: ['in_progress', 'completed', 'cancelled'],
  in_progress: ['completed'],
  completed: [],
  cancelled: [],
};

/** 409 `INVALID_STATE_TRANSITION` for a disallowed move. */
export function assertJobTransition(from: JobStatus, to: JobStatus): void {
  if (!JOB_TRANSITIONS[from].includes(to)) throw ApiError.invalidTransition('job', from, to);
}
