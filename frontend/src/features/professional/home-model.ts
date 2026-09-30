/**
 * Small view-model helpers of the professional Home tab. Pure.
 */
import type { JobSummary } from '@/types/domain';

/** Jobs waiting for the professional to confirm the appointment, soonest first. */
function jobsAwaitingConfirmation<T extends Pick<JobSummary, 'status' | 'scheduledStartAt'>>(jobs: readonly T[]): T[] {
  return jobs
    .filter((job) => job.status === 'awaiting_confirmation')
    .sort((a, b) => Date.parse(a.scheduledStartAt) - Date.parse(b.scheduledStartAt));
}

/**
 * The home's "Up next" rows: appointments waiting for the professional's confirmation first
 * (soonest first), then the next scheduled or running jobs by start time. At most `limit` rows.
 */
export function upNextJobs<T extends Pick<JobSummary, 'id' | 'status' | 'scheduledStartAt'>>(jobs: readonly T[], limit = 2): T[] {
  const awaiting = jobsAwaitingConfirmation(jobs);
  const others = jobs
    .filter((job) => job.status === 'scheduled' || job.status === 'in_progress')
    .sort((a, b) => Date.parse(a.scheduledStartAt) - Date.parse(b.scheduledStartAt));
  return [...awaiting, ...others].slice(0, Math.max(0, limit));
}
