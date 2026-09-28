import { summarizeCompletedJobs, upNextJobs } from '../home-model';

const local = (day: number, hour: number, minute = 0, month = 8) => new Date(2026, month, day, hour, minute);

describe('professional home model', () => {
  it('sums this month’s earnings of completed jobs', () => {
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
    expect(summary).toEqual({ thisMonthTotals: [{ currency: 'ILS', amount: 750.5 }] });
    expect(summarizeCompletedJobs([], now)).toEqual({ thisMonthTotals: [] });
  });

  it('lists jobs awaiting confirmation soonest first', () => {
    const jobs = [
      { id: 'a', status: 'scheduled' as const, scheduledStartAt: '2026-09-28T08:00:00.000Z' },
      { id: 'b', status: 'awaiting_confirmation' as const, scheduledStartAt: '2026-09-30T08:00:00.000Z' },
      { id: 'c', status: 'awaiting_confirmation' as const, scheduledStartAt: '2026-09-29T08:00:00.000Z' },
    ];
    expect(upNextJobs(jobs, 3).map((job) => job.id)).toEqual(['c', 'b', 'a']);
  });

  it('puts appointments awaiting confirmation first in "Up next"', () => {
    const jobs = [
      { id: 'done', status: 'completed' as const, scheduledStartAt: '2026-09-26T08:00:00.000Z' },
      { id: 'later', status: 'scheduled' as const, scheduledStartAt: '2026-10-02T08:00:00.000Z' },
      { id: 'soon', status: 'scheduled' as const, scheduledStartAt: '2026-09-28T08:00:00.000Z' },
      { id: 'confirm', status: 'awaiting_confirmation' as const, scheduledStartAt: '2026-10-01T08:00:00.000Z' },
      { id: 'running', status: 'in_progress' as const, scheduledStartAt: '2026-09-27T07:00:00.000Z' },
    ];
    expect(upNextJobs(jobs).map((job) => job.id)).toEqual(['confirm', 'running']);
    expect(upNextJobs(jobs, 4).map((job) => job.id)).toEqual(['confirm', 'running', 'soon', 'later']);
    expect(upNextJobs([])).toEqual([]);
  });
});
