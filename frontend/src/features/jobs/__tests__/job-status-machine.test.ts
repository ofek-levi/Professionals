import { JOB_STATUSES, type JobStatus } from '@/constants/job-statuses';

import { assertJobTransition, getJobActions, requestStatusForJobStatus } from '../job-status-machine';

const EXPECTED: Record<JobStatus, JobStatus[]> = {
  awaiting_confirmation: ['scheduled', 'cancelled'],
  scheduled: ['in_progress', 'completed', 'cancelled'],
  // Only through account deletion: no job action offers it.
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

describe('job status machine', () => {
  it('matches the documented transitions', () => {
    for (const from of JOB_STATUSES) {
      for (const to of JOB_STATUSES) {
        const assertion = expect(() => assertJobTransition(from, to));
        if (EXPECTED[from].includes(to)) assertion.not.toThrow();
        else assertion.toThrow(expect.objectContaining({ code: 'INVALID_STATE_TRANSITION', status: 409 }));
      }
    }
  });

  it('mirrors job statuses onto request statuses', () => {
    expect(requestStatusForJobStatus('awaiting_confirmation')).toBe('professional_selected');
    expect(requestStatusForJobStatus('scheduled')).toBe('scheduled');
    expect(requestStatusForJobStatus('in_progress')).toBe('in_progress');
    expect(requestStatusForJobStatus('completed')).toBe('completed');
    expect(requestStatusForJobStatus('cancelled')).toBe('cancelled');
  });

  it('derives role-specific actions', () => {
    expect(getJobActions({ status: 'awaiting_confirmation' }, 'professional', { hasReview: false })).toEqual({
      canConfirm: true,
      canStart: false,
      canComplete: false,
      canReview: false,
      canMessage: true,
    });
    expect(getJobActions({ status: 'awaiting_confirmation' }, 'customer', { hasReview: false })).toMatchObject({
      canConfirm: false,
    });
    expect(getJobActions({ status: 'scheduled' }, 'professional', { hasReview: false })).toMatchObject({
      canStart: true,
      canComplete: true,
    });
    expect(getJobActions({ status: 'in_progress' }, 'customer', { hasReview: false })).toMatchObject({
      canComplete: true,
      canStart: false,
    });
    expect(getJobActions({ status: 'completed' }, 'customer', { hasReview: false }).canReview).toBe(true);
    expect(getJobActions({ status: 'completed' }, 'customer', { hasReview: true }).canReview).toBe(false);
    expect(getJobActions({ status: 'completed' }, 'professional', { hasReview: false }).canReview).toBe(false);
    expect(getJobActions({ status: 'cancelled' }, 'customer', { hasReview: false }).canMessage).toBe(false);
  });
});
