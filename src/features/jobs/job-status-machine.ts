/**
 * Job status machine and the actions each party may take on a job.
 * Job status mirrors onto the request status via `JOB_STATUS_META[status].requestStatus`.
 */
import { JOB_STATUS_META, type JobStatus } from '@/constants/job-statuses';
import type { RequestStatus } from '@/constants/request-statuses';
import { assertTransition, canTransition, type TransitionTable } from '@/features/shared/state-machine';
import type { Job, UserRole } from '@/types/domain';

const JOB_TRANSITIONS: TransitionTable<JobStatus> = {
  awaiting_confirmation: ['scheduled', 'cancelled'],
  scheduled: ['in_progress', 'completed', 'cancelled'],
  in_progress: ['completed'],
  completed: [],
  cancelled: [],
};

function canTransitionJob(from: JobStatus, to: JobStatus): boolean {
  return canTransition(JOB_TRANSITIONS, from, to);
}

/** Throws `DomainError` `INVALID_STATE_TRANSITION` (409) for disallowed transitions. */
export function assertJobTransition(from: JobStatus, to: JobStatus): void {
  assertTransition(JOB_TRANSITIONS, 'job', from, to);
}

/** The request status that mirrors a job status. */
export function requestStatusForJobStatus(status: JobStatus): RequestStatus {
  return JOB_STATUS_META[status].requestStatus;
}

export function isJobActive(status: JobStatus): boolean {
  return JOB_STATUS_META[status].isActive;
}

export interface JobActions {
  /** Professional confirms the appointment (`awaiting_confirmation → scheduled`). */
  canConfirm: boolean;
  /** Professional starts the work (`scheduled → in_progress`). */
  canStart: boolean;
  /** Either party marks the job completed (`scheduled | in_progress → completed`). */
  canComplete: boolean;
  /** Customer reviews a completed job once. */
  canReview: boolean;
  /** Chat stays available unless the job was cancelled. */
  canMessage: boolean;
}

export function getJobActions(
  job: Pick<Job, 'status'>,
  role: UserRole,
  { hasReview }: { hasReview: boolean },
): JobActions {
  const isPro = role === 'professional';
  return {
    canConfirm: isPro && job.status === 'awaiting_confirmation',
    canStart: isPro && job.status === 'scheduled',
    canComplete: canTransitionJob(job.status, 'completed'),
    canReview: role === 'customer' && job.status === 'completed' && !hasReview,
    canMessage: job.status !== 'cancelled',
  };
}
