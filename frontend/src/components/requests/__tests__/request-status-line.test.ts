import { getRequestStatusLine } from '../request-status-line';

describe('getRequestStatusLine', () => {
  it('puts offers waiting for a decision first', () => {
    expect(getRequestStatusLine({ status: 'offers_received', pendingOfferCount: 3 })).toEqual({ kind: 'offersToReview', tone: 'brand', count: 3 });
  });

  it('waits for offers while none is pending', () => {
    expect(getRequestStatusLine({ status: 'open', pendingOfferCount: 0 }).kind).toBe('waitingForOffers');
    // The last pending offer was withdrawn or expired.
    expect(getRequestStatusLine({ status: 'offers_received', pendingOfferCount: 0 }).kind).toBe('waitingForOffers');
  });

  it('maps the remaining statuses to one phrase each', () => {
    const kind = (status: Parameters<typeof getRequestStatusLine>[0]['status']) => getRequestStatusLine({ status, pendingOfferCount: 0 }).kind;
    expect(kind('draft')).toBe('draft');
    expect(kind('professional_selected')).toBe('booked');
    expect(kind('scheduled')).toBe('booked');
    expect(kind('in_progress')).toBe('inProgress');
    expect(kind('completed')).toBe('completed');
    expect(kind('cancelled')).toBe('cancelled');
  });
});
