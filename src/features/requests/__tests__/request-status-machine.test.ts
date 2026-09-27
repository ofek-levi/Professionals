import { REQUEST_STATUSES, type RequestStatus } from '@/constants/request-statuses';
import { DomainError } from '@/features/shared/domain-error';

import {
  assertRequestTransition,
  canTransitionRequest,
  CANCELLABLE_REQUEST_STATUSES,
  getCustomerRequestActions,
  getCustomerRequestSection,
  REQUEST_TRANSITIONS,
  requestStatusForPendingOffers,
} from '../request-status-machine';

const EXPECTED: Record<RequestStatus, RequestStatus[]> = {
  draft: ['open', 'cancelled'],
  open: ['offers_received', 'cancelled'],
  offers_received: ['open', 'professional_selected', 'cancelled'],
  professional_selected: ['scheduled', 'cancelled'],
  scheduled: ['in_progress', 'completed', 'cancelled'],
  in_progress: ['completed'],
  completed: [],
  cancelled: [],
};

describe('request status machine', () => {
  it('matches the documented transition table exactly', () => {
    for (const from of REQUEST_STATUSES) {
      expect([...REQUEST_TRANSITIONS[from]].sort()).toEqual([...EXPECTED[from]].sort());
      for (const to of REQUEST_STATUSES) {
        expect(canTransitionRequest(from, to)).toBe(EXPECTED[from].includes(to));
      }
    }
  });

  it('throws INVALID_STATE_TRANSITION for disallowed transitions', () => {
    expect(() => assertRequestTransition('draft', 'open')).not.toThrow();
    try {
      assertRequestTransition('completed', 'open');
      throw new Error('expected to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect(error).toMatchObject({ code: 'INVALID_STATE_TRANSITION', status: 409 });
    }
  });

  it('knows which statuses can be cancelled', () => {
    expect([...CANCELLABLE_REQUEST_STATUSES].sort()).toEqual(
      ['draft', 'open', 'offers_received', 'professional_selected', 'scheduled'].sort(),
    );
  });

  it('derives customer actions', () => {
    expect(getCustomerRequestActions({ status: 'draft', pendingOfferCount: 0 })).toEqual({
      canCancel: true,
      canEditDraft: true,
      canPublish: true,
      canDeleteDraft: true,
      canReviewOffers: false,
    });
    expect(getCustomerRequestActions({ status: 'offers_received', pendingOfferCount: 2 })).toMatchObject({
      canCancel: true,
      canPublish: false,
      canReviewOffers: true,
    });
    expect(getCustomerRequestActions({ status: 'in_progress', pendingOfferCount: 0 })).toMatchObject({
      canCancel: false,
      canReviewOffers: false,
    });
  });

  it('assigns each request to exactly one section', () => {
    const section = (status: RequestStatus, pendingOfferCount = 0) => getCustomerRequestSection({ status, pendingOfferCount });
    expect(section('draft')).toBe('drafts');
    expect(section('open')).toBe('awaiting_offers');
    expect(section('offers_received', 2)).toBe('has_offers');
    expect(section('professional_selected')).toBe('active');
    expect(section('scheduled')).toBe('active');
    expect(section('in_progress')).toBe('active');
    expect(section('completed')).toBe('completed');
    expect(section('cancelled')).toBe('cancelled');
  });

  it('flips open ⇄ offers_received with the pending offer count', () => {
    expect(requestStatusForPendingOffers('open', 1)).toBe('offers_received');
    expect(requestStatusForPendingOffers('offers_received', 0)).toBe('open');
    expect(requestStatusForPendingOffers('offers_received', 3)).toBe('offers_received');
    expect(requestStatusForPendingOffers('scheduled', 0)).toBe('scheduled');
  });
});
