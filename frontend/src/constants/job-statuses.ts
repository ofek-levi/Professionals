/**
 * Job execution status (exists only after an offer was accepted).
 * Transition rules live in `features/jobs/job-status-machine.ts`.
 * Labels are localized via `common:jobStatus.<status>`.
 */
import type { RequestStatus } from './request-statuses';
import type { StatusTone } from './tones';

export const JOB_STATUSES = ['awaiting_confirmation', 'scheduled', 'in_progress', 'completed', 'cancelled'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

interface JobStatusMeta {
  tone: StatusTone;
  isActive: boolean;
  /** The request status that mirrors this job status. */
  requestStatus: RequestStatus;
}

export const JOB_STATUS_META: Record<JobStatus, JobStatusMeta> = {
  awaiting_confirmation: { tone: 'info', isActive: true, requestStatus: 'professional_selected' },
  scheduled: { tone: 'info', isActive: true, requestStatus: 'scheduled' },
  in_progress: { tone: 'warning', isActive: true, requestStatus: 'in_progress' },
  completed: { tone: 'success', isActive: false, requestStatus: 'completed' },
  cancelled: { tone: 'danger', isActive: false, requestStatus: 'cancelled' },
};
