import { act, renderHook } from '@testing-library/react-native';

import type { CustomerRequestView, JobSummary } from '@/types/domain';

import {
  appointmentsByRequest,
  buildHomeActiveRows,
  parseRequestListTab,
  REQUEST_TAB_STATUSES,
  sortActiveRequests,
  type HomeActiveRow,
} from '../customer-home-model';
import { hasUnseenOffers, markOffersSeen, useSeenOffers, type SeenOffersMap } from '../seen-offers-store';

function request(overrides: Partial<CustomerRequestView> = {}): CustomerRequestView {
  return {
    id: 'req_1',
    customerId: 'user_1',
    categoryId: 'plumbing',
    description: 'Leaking kitchen faucet needs a fix',
    location: {
      coordinates: { latitude: 32.08, longitude: 34.78 },
      addressLine: 'Dizengoff St 120',
      city: 'Tel Aviv-Yafo',
      neighborhood: null,
      details: null,
      isApproximate: false,
    },
    urgency: 'normal',
    preferredSchedule: null,
    photos: [],
    notes: null,
    status: 'open',
    offerCount: 0,
    pendingOfferCount: 0,
    acceptedOfferId: null,
    jobId: null,
    publishedAt: '2026-09-26T10:00:00.000Z',
    cancelledAt: null,
    cancellationReason: null,
    cancellationComment: null,
    createdAt: '2026-09-26T09:50:00.000Z',
    updatedAt: '2026-09-26T10:00:00.000Z',
    latestOfferAt: null,
    lowestOfferPrice: null,
    matchedProfessionalCount: 2,
    ...overrides,
  };
}

/** Only the fields the home model reads (the rest is irrelevant here). */
function job(id: string, requestId: string, scheduledStartAt = '2026-09-29T07:00:00.000Z'): JobSummary {
  return { id, requestId, scheduledStartAt, categoryId: 'electrical' } as JobSummary;
}

const ids = (rows: HomeActiveRow[]) => rows.map((row) => (row.kind === 'request' ? row.request.id : `review:${row.job.id}`));

describe('Requests tab segments', () => {
  it('splits the statuses into active and past', () => {
    expect(REQUEST_TAB_STATUSES.active).toEqual(['draft', 'open', 'offers_received', 'professional_selected', 'scheduled', 'in_progress']);
    expect(REQUEST_TAB_STATUSES.past).toEqual(['completed', 'cancelled']);
  });

  it('reads ?tab=', () => {
    expect(parseRequestListTab('past')).toBe('past');
    expect(parseRequestListTab('active')).toBe('active');
    expect(parseRequestListTab('nonsense')).toBe('active');
    expect(parseRequestListTab(undefined)).toBe('active');
  });
});

describe('sortActiveRequests', () => {
  it('puts requests needing a decision first and keeps the server order otherwise', () => {
    const waiting = request({ id: 'waiting' });
    const draft = request({ id: 'draft', status: 'draft', publishedAt: null });
    const offers = request({ id: 'offers', status: 'offers_received', pendingOfferCount: 2 });
    const booked = request({ id: 'booked', status: 'scheduled' });
    const waitingToo = request({ id: 'waiting2', status: 'offers_received', pendingOfferCount: 0 });
    expect(sortActiveRequests([draft, waiting, booked, offers, waitingToo]).map((item) => item.id)).toEqual([
      'offers',
      'booked',
      'waiting',
      'waiting2',
      'draft',
    ]);
  });

  it('ranks past requests last', () => {
    const completed = request({ id: 'completed', status: 'completed' });
    const draft = request({ id: 'draft', status: 'draft' });
    expect(sortActiveRequests([completed, draft]).map((item) => item.id)).toEqual(['draft', 'completed']);
  });
});

describe('buildHomeActiveRows', () => {
  it('orders offers, the review prompt, booked work (soonest first), waiting and drafts – at most three', () => {
    const rows = buildHomeActiveRows({
      requests: [
        request({ id: 'draft', status: 'draft' }),
        request({ id: 'waiting' }),
        request({ id: 'late', status: 'scheduled' }),
        request({ id: 'soon', status: 'professional_selected' }),
        request({ id: 'offers-old', status: 'offers_received', pendingOfferCount: 1, latestOfferAt: '2026-09-26T11:00:00.000Z' }),
        request({ id: 'offers-new', status: 'offers_received', pendingOfferCount: 3, latestOfferAt: '2026-09-27T08:00:00.000Z' }),
      ],
      upcomingJobs: [job('job_late', 'late', '2026-10-02T07:00:00.000Z'), job('job_soon', 'soon', '2026-09-28T07:00:00.000Z')],
      jobsAwaitingReview: [job('job_done', 'req_done')],
    });
    expect(ids(rows)).toEqual(['offers-new', 'offers-old', 'review:job_done']);

    const all = buildHomeActiveRows(
      {
        requests: [request({ id: 'draft', status: 'draft' }), request({ id: 'waiting' }), request({ id: 'late', status: 'scheduled' }), request({ id: 'soon', status: 'scheduled' })],
        upcomingJobs: [job('job_late', 'late', '2026-10-02T07:00:00.000Z'), job('job_soon', 'soon', '2026-09-28T07:00:00.000Z')],
        jobsAwaitingReview: [],
      },
      10,
    );
    expect(ids(all)).toEqual(['soon', 'late', 'waiting', 'draft']);
    const soon = all[0];
    expect(soon.kind === 'request' ? soon.appointmentAt : null).toBe('2026-09-28T07:00:00.000Z');
  });

  it('always makes room for the review prompt after offers', () => {
    const rows = buildHomeActiveRows({
      requests: [request({ id: 'a' }), request({ id: 'b' }), request({ id: 'c', status: 'scheduled' })],
      upcomingJobs: [],
      jobsAwaitingReview: [job('job_1', 'req_x'), job('job_2', 'req_y')],
    });
    expect(ids(rows)).toEqual(['review:job_1', 'c', 'a']);
  });

  it('is empty without anything active', () => {
    expect(buildHomeActiveRows({ requests: [request({ status: 'completed' })], upcomingJobs: [], jobsAwaitingReview: [] })).toEqual([]);
  });

  it('maps appointments by request', () => {
    expect(appointmentsByRequest([job('j', 'req_9', '2026-09-30T08:00:00.000Z')]).get('req_9')).toBe('2026-09-30T08:00:00.000Z');
  });
});

describe('seen offers', () => {
  it('reports offers newer than the last visit', () => {
    const item = request({ pendingOfferCount: 2, latestOfferAt: '2026-09-27T08:00:00.000Z' });
    const empty: SeenOffersMap = new Map();
    expect(hasUnseenOffers(item, empty)).toBe(true);
    expect(hasUnseenOffers(item, new Map([['req_1', '2026-09-27T08:00:00.000Z']]))).toBe(false);
    expect(hasUnseenOffers(item, new Map([['req_1', '2026-09-27T07:00:00.000Z']]))).toBe(true);
    expect(hasUnseenOffers({ ...item, pendingOfferCount: 0 }, empty)).toBe(false);
  });

  it('never moves the seen marker backwards', async () => {
    const { result } = await renderHook(() => useSeenOffers());
    await act(() => markOffersSeen('req_1', '2026-09-27T08:00:00.000Z'));
    const snapshot = result.current;
    await act(() => {
      markOffersSeen('req_1', '2026-09-27T07:00:00.000Z');
      markOffersSeen('req_1', null);
    });
    expect(result.current).toBe(snapshot);
    expect(result.current.get('req_1')).toBe('2026-09-27T08:00:00.000Z');
    const item = request({ pendingOfferCount: 1, latestOfferAt: '2026-09-27T08:00:00.000Z' });
    expect(hasUnseenOffers(item, result.current)).toBe(false);
    await act(() => markOffersSeen('req_1', '2026-09-27T09:00:00.000Z'));
    expect(result.current).not.toBe(snapshot);
  });
});
