import { getJobActions } from '@/features/jobs/job-status-machine';
import type { Job, JobStatus, UserRole } from '@/types/domain';

import { getJobTimeline, planJobActions } from '../job-view-model';

type TimelineJob = Pick<Job, 'status' | 'createdAt' | 'confirmedAt' | 'startedAt' | 'completedAt' | 'cancelledAt'>;

function job(status: JobStatus, overrides: Partial<TimelineJob> = {}): TimelineJob {
  return {
    status,
    createdAt: '2026-09-25T08:00:00.000Z',
    confirmedAt: null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    ...overrides,
  };
}

const states = (timeline: ReturnType<typeof getJobTimeline>) => timeline.map((step) => `${step.key}:${step.state}`);

describe('getJobTimeline', () => {
  it('highlights the next expected step while the job is active', () => {
    expect(states(getJobTimeline(job('awaiting_confirmation')))).toEqual([
      'accepted:done',
      'confirmed:next',
      'in_progress:upcoming',
      'completed:upcoming',
    ]);
    expect(states(getJobTimeline(job('scheduled', { confirmedAt: '2026-09-25T09:00:00.000Z' })))).toEqual([
      'accepted:done',
      'confirmed:done',
      'in_progress:next',
      'completed:upcoming',
    ]);
    const inProgress = getJobTimeline(job('in_progress', { confirmedAt: 'c', startedAt: 's' }));
    expect(states(inProgress)).toEqual(['accepted:done', 'confirmed:done', 'in_progress:active', 'completed:next']);
    expect(inProgress[2].at).toBe('s');
  });

  it('marks the start as skipped when a scheduled job was completed directly', () => {
    expect(states(getJobTimeline(job('completed', { confirmedAt: 'c', completedAt: 'd' })))).toEqual([
      'accepted:done',
      'confirmed:done',
      'in_progress:skipped',
      'completed:done',
    ]);
    expect(states(getJobTimeline(job('completed', { confirmedAt: 'c', startedAt: 's', completedAt: 'd' })))[2]).toBe('in_progress:done');
  });

  it('ends with a cancellation step and keeps only the steps that happened', () => {
    expect(states(getJobTimeline(job('cancelled', { cancelledAt: 'x' })))).toEqual(['accepted:done', 'cancelled:cancelled']);
    expect(states(getJobTimeline(job('cancelled', { confirmedAt: 'c', cancelledAt: 'x' })))).toEqual([
      'accepted:done',
      'confirmed:done',
      'cancelled:cancelled',
    ]);
    // An account deletion cancels a job in progress: the start stays on the record.
    const cancelledInProgress = getJobTimeline(job('cancelled', { confirmedAt: 'c', startedAt: 's', cancelledAt: 'x' }));
    expect(states(cancelledInProgress)).toEqual(['accepted:done', 'confirmed:done', 'in_progress:done', 'cancelled:cancelled']);
    expect(cancelledInProgress[2].at).toBe('s');
  });
});

describe('planJobActions', () => {
  const plan = (status: JobStatus, role: UserRole, canReview = status === 'completed') =>
    planJobActions({ status }, role, getJobActions({ status, canReview }, role));

  it('walks the professional through confirm → start → complete', () => {
    expect(plan('awaiting_confirmation', 'professional')).toEqual({ primary: 'confirm', secondary: [], message: true });
    expect(plan('scheduled', 'professional')).toEqual({ primary: 'start', secondary: ['complete'], message: true });
    expect(plan('in_progress', 'professional')).toEqual({ primary: 'complete', secondary: [], message: true });
    expect(plan('completed', 'professional')).toEqual({ primary: null, secondary: [], message: true });
  });

  it('gives the customer completion and review at the right time (cancelling lives on the request)', () => {
    expect(plan('awaiting_confirmation', 'customer')).toEqual({ primary: null, secondary: [], message: true });
    expect(plan('scheduled', 'customer')).toEqual({ primary: null, secondary: ['complete'], message: true });
    expect(plan('in_progress', 'customer')).toEqual({ primary: 'complete', secondary: [], message: true });
    expect(plan('completed', 'customer')).toEqual({ primary: 'review', secondary: [], message: true });
    // Reviewed already, or the professional deleted their account (the server's `canReview`).
    expect(plan('completed', 'customer', false)).toEqual({ primary: null, secondary: [], message: true });
  });

  it('offers nothing but information once cancelled', () => {
    expect(plan('cancelled', 'customer')).toEqual({ primary: null, secondary: [], message: false });
    expect(plan('cancelled', 'professional')).toEqual({ primary: null, secondary: [], message: false });
  });
});
