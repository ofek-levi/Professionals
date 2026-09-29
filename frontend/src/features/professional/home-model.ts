/**
 * Small view-model helpers of the professional Home and Work tabs. Pure, deterministic given `now`.
 */
import type { JobSummary } from '@/types/domain';
import { toDate, type DateInput } from '@/utils/dates';

interface CompletedJobsSummary {
  /** Sum of agreed prices per currency of the jobs completed in the calendar month of `now`. */
  thisMonthTotals: { currency: string; amount: number }[];
}

function sumByCurrency(jobs: readonly Pick<JobSummary, 'agreedPrice' | 'currency'>[]): { currency: string; amount: number }[] {
  const totals = new Map<string, number>();
  for (const job of jobs) totals.set(job.currency, (totals.get(job.currency) ?? 0) + job.agreedPrice);
  return [...totals.entries()]
    .map(([currency, amount]) => ({ currency, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount);
}

/** This month’s earnings from completed jobs (the Work tab’s "This month" total). */
export function summarizeCompletedJobs(
  jobs: readonly Pick<JobSummary, 'status' | 'agreedPrice' | 'currency' | 'completedAt' | 'updatedAt'>[],
  now: DateInput,
): CompletedJobsSummary {
  const completed = jobs.filter((job) => job.status === 'completed');
  const reference = toDate(now);
  const thisMonth = completed.filter((job) => {
    const at = toDate(job.completedAt ?? job.updatedAt);
    return at.getFullYear() === reference.getFullYear() && at.getMonth() === reference.getMonth();
  });
  return { thisMonthTotals: sumByCurrency(thisMonth) };
}

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
