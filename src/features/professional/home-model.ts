/**
 * Small view-model helpers of the professional home and jobs tabs. Pure, deterministic given `now`.
 */
import { getWorkingHoursForDate } from '@/features/profiles/availability';
import type { JobSummary, TimeOfDayString, WeeklyAvailability } from '@/types/domain';
import { minutesOfDay, timeToMinutes, toDate, type DateInput } from '@/utils/dates';

export type GreetingPeriod = 'morning' | 'afternoon' | 'evening' | 'night';

/** 05–12 morning, 12–17 afternoon, 17–22 evening, otherwise night. */
export function greetingPeriod(now: DateInput): GreetingPeriod {
  const hour = toDate(now).getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

export type TodayAvailability =
  | { state: 'dayOff' }
  | { state: 'beforeHours' | 'working' | 'afterHours'; start: TimeOfDayString; end: TimeOfDayString };

/** The professional's status for today according to the weekly working hours. */
export function getTodayAvailability(availability: WeeklyAvailability, now: DateInput): TodayAvailability {
  const hours = getWorkingHoursForDate(availability, now);
  if (!hours) return { state: 'dayOff' };
  const minutes = minutesOfDay(now);
  const state = minutes < timeToMinutes(hours.start) ? 'beforeHours' : minutes < timeToMinutes(hours.end) ? 'working' : 'afterHours';
  return { state, ...hours };
}

export interface CompletedJobsSummary {
  count: number;
  /** Sum of agreed prices per currency (normally a single ILS entry). */
  totals: { currency: string; amount: number }[];
  /** Completed in the calendar month of `now`. */
  thisMonthCount: number;
  thisMonthTotals: { currency: string; amount: number }[];
}

function sumByCurrency(jobs: readonly Pick<JobSummary, 'agreedPrice' | 'currency'>[]): { currency: string; amount: number }[] {
  const totals = new Map<string, number>();
  for (const job of jobs) totals.set(job.currency, (totals.get(job.currency) ?? 0) + job.agreedPrice);
  return [...totals.entries()]
    .map(([currency, amount]) => ({ currency, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount);
}

/** Earnings summary of the completed-jobs tab. */
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
  return {
    count: completed.length,
    totals: sumByCurrency(completed),
    thisMonthCount: thisMonth.length,
    thisMonthTotals: sumByCurrency(thisMonth),
  };
}

/** Jobs waiting for the professional to confirm the appointment, soonest first. */
export function jobsAwaitingConfirmation<T extends Pick<JobSummary, 'status' | 'scheduledStartAt'>>(jobs: readonly T[]): T[] {
  return jobs
    .filter((job) => job.status === 'awaiting_confirmation')
    .sort((a, b) => Date.parse(a.scheduledStartAt) - Date.parse(b.scheduledStartAt));
}
