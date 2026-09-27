import { createDefaultAvailability } from '@/features/profiles/availability';

import { getTodayAvailability, greetingPeriod, jobsAwaitingConfirmation, summarizeCompletedJobs } from '../home-model';

// 2026-09-27 is a Sunday, 2026-10-03 a Saturday (day off in the default availability).
const local = (day: number, hour: number, minute = 0, month = 8) => new Date(2026, month, day, hour, minute);

describe('professional home model', () => {
  it('picks a greeting by time of day', () => {
    expect(greetingPeriod(local(27, 6))).toBe('morning');
    expect(greetingPeriod(local(27, 12))).toBe('afternoon');
    expect(greetingPeriod(local(27, 19))).toBe('evening');
    expect(greetingPeriod(local(27, 23))).toBe('night');
    expect(greetingPeriod(local(27, 3))).toBe('night');
  });

  it('describes today’s availability', () => {
    const availability = createDefaultAvailability();
    expect(getTodayAvailability(availability, local(27, 7))).toEqual({ state: 'beforeHours', start: '08:00', end: '18:00' });
    expect(getTodayAvailability(availability, local(27, 12))).toEqual({ state: 'working', start: '08:00', end: '18:00' });
    expect(getTodayAvailability(availability, local(27, 18))).toEqual({ state: 'afterHours', start: '08:00', end: '18:00' });
    expect(getTodayAvailability(availability, local(3, 12, 0, 9))).toEqual({ state: 'dayOff' });
  });

  it('summarizes completed jobs and this month’s earnings', () => {
    const now = local(27, 12);
    const job = (status: 'completed' | 'scheduled', price: number, completedAt: string | null, currency = 'ILS') => ({
      status,
      agreedPrice: price,
      currency: currency as 'ILS',
      completedAt,
      updatedAt: completedAt ?? now.toISOString(),
    });
    const summary = summarizeCompletedJobs(
      [
        job('completed', 300, local(20, 10).toISOString()),
        job('completed', 450.5, local(2, 10).toISOString()),
        job('completed', 1000, local(20, 10, 0, 7).toISOString()),
        job('scheduled', 999, null),
      ],
      now,
    );
    expect(summary).toEqual({
      count: 3,
      totals: [{ currency: 'ILS', amount: 1750.5 }],
      thisMonthCount: 2,
      thisMonthTotals: [{ currency: 'ILS', amount: 750.5 }],
    });
    expect(summarizeCompletedJobs([], now)).toEqual({ count: 0, totals: [], thisMonthCount: 0, thisMonthTotals: [] });
  });

  it('lists jobs awaiting confirmation soonest first', () => {
    const jobs = [
      { id: 'a', status: 'scheduled' as const, scheduledStartAt: '2026-09-28T08:00:00.000Z' },
      { id: 'b', status: 'awaiting_confirmation' as const, scheduledStartAt: '2026-09-30T08:00:00.000Z' },
      { id: 'c', status: 'awaiting_confirmation' as const, scheduledStartAt: '2026-09-29T08:00:00.000Z' },
    ];
    expect(jobsAwaitingConfirmation(jobs).map((job) => job.id)).toEqual(['c', 'b']);
  });
});
