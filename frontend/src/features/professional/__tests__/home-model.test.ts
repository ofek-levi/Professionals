import { profileGaps, upNextJobs } from '../home-model';

describe('professional home model', () => {
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

describe('profileGaps', () => {
  it('lists the empty parts of a new professional’s public profile', () => {
    expect(profileGaps({ avatarUrl: null, headline: '', bio: ' ' })).toEqual(['photo', 'headline', 'bio']);
    expect(profileGaps({ avatarUrl: 'https://img/1.jpg', headline: 'Plumber', bio: '' })).toEqual(['bio']);
    expect(profileGaps({ avatarUrl: 'https://img/1.jpg', headline: 'Plumber', bio: 'Twenty years of fixing leaks in Haifa.' })).toEqual([]);
  });
});
