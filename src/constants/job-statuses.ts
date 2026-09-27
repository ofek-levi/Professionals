/**
 * Job execution status (exists only after an offer was accepted).
 * Transition rules live in `features/jobs/job-status-machine.ts`.
 * Labels are localized via `common:jobStatus.<status>`.
 */
import type { RequestStatus } from './request-statuses';
import type { StatusTone } from './tones';

export const JOB_STATUSES = ['awaiting_confirmation', 'scheduled', 'in_progress', 'completed', 'cancelled'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export interface JobStatusMeta {
  status: JobStatus;
  tone: StatusTone;
  icon: string;
  isActive: boolean;
  isTerminal: boolean;
  /** The request status that mirrors this job status. */
  requestStatus: RequestStatus;
}

export const JOB_STATUS_META: Record<JobStatus, JobStatusMeta> = {
  awaiting_confirmation: { status: 'awaiting_confirmation', tone: 'accent', icon: 'account-clock-outline', isActive: true, isTerminal: false, requestStatus: 'professional_selected' },
  scheduled: { status: 'scheduled', tone: 'accent', icon: 'calendar-check-outline', isActive: true, isTerminal: false, requestStatus: 'scheduled' },
  in_progress: { status: 'in_progress', tone: 'warning', icon: 'progress-wrench', isActive: true, isTerminal: false, requestStatus: 'in_progress' },
  completed: { status: 'completed', tone: 'success', icon: 'check-decagram-outline', isActive: false, isTerminal: true, requestStatus: 'completed' },
  cancelled: { status: 'cancelled', tone: 'danger', icon: 'close-circle-outline', isActive: false, isTerminal: true, requestStatus: 'cancelled' },
};

export const ACTIVE_JOB_STATUSES: readonly JobStatus[] = ['awaiting_confirmation', 'scheduled', 'in_progress'];

export function isJobStatus(value: unknown): value is JobStatus {
  return typeof value === 'string' && (JOB_STATUSES as readonly string[]).includes(value);
}
