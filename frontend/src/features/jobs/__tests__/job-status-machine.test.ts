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

/** A job of two parties who still have their accounts, unless `deleted` names the one who deleted theirs. */
const job = (status: JobStatus, canReview = false, deleted?: 'professional' | 'customer') => ({
  status,
  canReview,
  professional: { accountDeleted: deleted === 'professional' },
  customer: { accountDeleted: deleted === 'customer' },
});

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
    expect(getJobActions(job('awaiting_confirmation'), 'professional')).toEqual({
      canConfirm: true,
      canStart: false,
      canComplete: false,
      canReview: false,
      canMessage: true,
    });
    expect(getJobActions(job('awaiting_confirmation'), 'customer')).toMatchObject({
      canConfirm: false,
    });
    expect(getJobActions(job('scheduled'), 'professional')).toMatchObject({
      canStart: true,
      canComplete: true,
    });
    expect(getJobActions(job('in_progress'), 'customer')).toMatchObject({
      canComplete: true,
      canStart: false,
    });
    expect(getJobActions(job('completed', true), 'customer').canReview).toBe(true);
    // The server's verdict: already reviewed, or the professional deleted their account.
    expect(getJobActions(job('completed'), 'customer').canReview).toBe(false);
    expect(getJobActions(job('completed', true), 'professional').canReview).toBe(false);
    expect(getJobActions(job('cancelled'), 'customer').canMessage).toBe(false);
    // The chat closes when either party deletes their account, also on a completed job.
    expect(getJobActions(job('completed', false, 'professional'), 'customer').canMessage).toBe(false);
    expect(getJobActions(job('completed', false, 'customer'), 'professional').canMessage).toBe(false);
    expect(getJobActions(job('completed'), 'professional').canMessage).toBe(true);
  });
});
