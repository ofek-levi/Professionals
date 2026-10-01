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
    expect(getJobActions({ status: 'awaiting_confirmation', canReview: false }, 'professional')).toEqual({
      canConfirm: true,
      canStart: false,
      canComplete: false,
      canReview: false,
      canMessage: true,
    });
    expect(getJobActions({ status: 'awaiting_confirmation', canReview: false }, 'customer')).toMatchObject({
      canConfirm: false,
    });
    expect(getJobActions({ status: 'scheduled', canReview: false }, 'professional')).toMatchObject({
      canStart: true,
      canComplete: true,
    });
    expect(getJobActions({ status: 'in_progress', canReview: false }, 'customer')).toMatchObject({
      canComplete: true,
      canStart: false,
    });
    expect(getJobActions({ status: 'completed', canReview: true }, 'customer').canReview).toBe(true);
    // The server's verdict: already reviewed, or the professional deleted their account.
    expect(getJobActions({ status: 'completed', canReview: false }, 'customer').canReview).toBe(false);
    expect(getJobActions({ status: 'completed', canReview: true }, 'professional').canReview).toBe(false);
    expect(getJobActions({ status: 'cancelled', canReview: false }, 'customer').canMessage).toBe(false);
  });
});
