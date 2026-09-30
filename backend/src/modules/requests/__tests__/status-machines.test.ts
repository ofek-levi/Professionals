import { describe, expect, it } from 'vitest';

import { JOB_STATUSES, REQUEST_STATUSES, type JobStatus, type RequestStatus } from '../../../shared/statuses.js';
import { assertJobTransition } from '../../jobs/job-rules.js';
import { assertCustomerCanCancel, assertRequestTransition } from '../request-rules.js';

const REQUEST_EXPECTED: Record<RequestStatus, RequestStatus[]> = {
  draft: ['open', 'cancelled'],
  open: ['offers_received', 'cancelled'],
  offers_received: ['open', 'professional_selected', 'cancelled'],
  professional_selected: ['scheduled', 'cancelled'],
  scheduled: ['in_progress', 'completed', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

const JOB_EXPECTED: Record<JobStatus, JobStatus[]> = {
  awaiting_confirmation: ['scheduled', 'cancelled'],
  scheduled: ['in_progress', 'completed', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

const INVALID = expect.objectContaining({ status: 409, code: 'INVALID_STATE_TRANSITION' });

describe('status machines (the app’s tables)', () => {
  it('request transitions', () => {
    for (const from of REQUEST_STATUSES) {
      for (const to of REQUEST_STATUSES) {
        if (REQUEST_EXPECTED[from].includes(to)) expect(() => assertRequestTransition(from, to)).not.toThrow();
        else expect(() => assertRequestTransition(from, to)).toThrow(INVALID);
      }
    }
  });

  it('job transitions', () => {
    for (const from of JOB_STATUSES) {
      for (const to of JOB_STATUSES) {
        if (JOB_EXPECTED[from].includes(to)) expect(() => assertJobTransition(from, to)).not.toThrow();
        else expect(() => assertJobTransition(from, to)).toThrow(INVALID);
      }
    }
  });

  it('the customer cancels until the work starts (in_progress → cancelled is for account deletion)', () => {
    const cancellable = REQUEST_STATUSES.filter((status) => {
      try {
        assertCustomerCanCancel(status);
        return true;
      } catch {
        return false;
      }
    });
    expect(cancellable).toEqual(['draft', 'open', 'offers_received', 'professional_selected', 'scheduled']);
    expect(() => assertCustomerCanCancel('in_progress')).toThrow(INVALID);
  });
});
