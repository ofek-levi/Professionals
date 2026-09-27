import type { CustomerDashboard } from '@/types/api';
import type { CustomerRequestView, OfferWithProfessional } from '@/types/domain';

import { getGreetingPeriod, getOffersAttentionTarget, hasCustomerActivity } from '../customer-home-model';
import { getCompareBestIds, offerStatusesForFilter } from '../offer-comparison';
import { buildRequestTimeline } from '../request-timeline';
import { getSeenOffers, hasUnseenOffers, markOffersSeen, resetSeenOffers, type SeenOffersMap } from '../seen-offers-store';

const at = (hour: number) => new Date(2026, 8, 27, hour, 30);

describe('getGreetingPeriod', () => {
  it.each([
    [5, 'morning'],
    [11, 'morning'],
    [12, 'afternoon'],
    [16, 'afternoon'],
    [17, 'evening'],
    [21, 'evening'],
    [22, 'night'],
    [2, 'night'],
  ])('%i:30 → %s', (hour, expected) => {
    expect(getGreetingPeriod(at(hour))).toBe(expected);
  });
});

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
    ...overrides,
  };
}

function dashboard(overrides: Partial<CustomerDashboard> = {}): CustomerDashboard {
  return {
    openRequestsCount: 0,
    requestsWithOffersCount: 0,
    pendingOffersCount: 0,
    activeJobsCount: 0,
    recentRequests: [],
    upcomingJobs: [],
    jobsAwaitingReview: [],
    ...overrides,
  };
}

describe('getOffersAttentionTarget', () => {
  it('opens the single request with offers directly', () => {
    const withOffers = request({ id: 'req_offers', status: 'offers_received', pendingOfferCount: 2 });
    const target = getOffersAttentionTarget(dashboard({ requestsWithOffersCount: 1, recentRequests: [request(), withOffers] }));
    expect(target).toEqual({ kind: 'request', requestId: 'req_offers' });
  });

  it('falls back to the "with offers" section for several requests', () => {
    const target = getOffersAttentionTarget(
      dashboard({ requestsWithOffersCount: 2, recentRequests: [request({ pendingOfferCount: 1, status: 'offers_received' })] }),
    );
    expect(target).toEqual({ kind: 'section', section: 'has_offers' });
  });

  it('falls back to the section when the request is not among the recent ones', () => {
    expect(getOffersAttentionTarget(dashboard({ requestsWithOffersCount: 1 }))).toEqual({ kind: 'section', section: 'has_offers' });
  });
});

describe('hasCustomerActivity', () => {
  it('is false for a brand new customer', () => {
    expect(hasCustomerActivity(dashboard())).toBe(false);
  });
  it('is true with any request or job', () => {
    expect(hasCustomerActivity(dashboard({ recentRequests: [request()] }))).toBe(true);
    expect(hasCustomerActivity(dashboard({ activeJobsCount: 1 }))).toBe(true);
  });
});

describe('buildRequestTimeline', () => {
  const job = {
    createdAt: '2026-09-26T12:00:00.000Z',
    confirmedAt: '2026-09-26T13:00:00.000Z',
    startedAt: null,
    completedAt: null,
    scheduledStartAt: '2026-09-28T09:00:00.000Z',
  };

  const states = (steps: ReturnType<typeof buildRequestTimeline>) => steps.map((step) => `${step.key}:${step.state}`);

  it('marks offers as in progress for an open request', () => {
    expect(states(buildRequestTimeline(request()))).toEqual([
      'published:done',
      'offers:current',
      'selected:upcoming',
      'scheduled:upcoming',
      'in_progress:upcoming',
      'completed:upcoming',
    ]);
  });

  it('asks for a decision once offers arrived', () => {
    const steps = buildRequestTimeline(request({ status: 'offers_received', offerCount: 2 }));
    expect(states(steps).slice(0, 3)).toEqual(['published:done', 'offers:done', 'selected:current']);
    expect(steps[0].at).toBe('2026-09-26T10:00:00.000Z');
  });

  it('shows the planned appointment on the in-progress step when scheduled', () => {
    const steps = buildRequestTimeline(request({ status: 'scheduled', acceptedOfferId: 'off_1' }), job);
    expect(states(steps)).toEqual([
      'published:done',
      'offers:done',
      'selected:done',
      'scheduled:done',
      'in_progress:current',
      'completed:upcoming',
    ]);
    expect(steps[3].at).toBe(job.confirmedAt);
    expect(steps[4].at).toBe(job.scheduledStartAt);
  });

  it('completes every step', () => {
    const steps = buildRequestTimeline(request({ status: 'completed' }), {
      ...job,
      startedAt: '2026-09-28T09:05:00.000Z',
      completedAt: '2026-09-28T11:00:00.000Z',
    });
    expect(steps.every((step) => step.state === 'done')).toBe(true);
    expect(steps[4].at).toBe('2026-09-28T09:05:00.000Z');
    expect(steps[5].at).toBe('2026-09-28T11:00:00.000Z');
  });

  it('ends with a cancelled step at the point the request was cancelled', () => {
    const steps = buildRequestTimeline(
      request({ status: 'cancelled', offerCount: 1, cancelledAt: '2026-09-27T08:00:00.000Z' }),
    );
    expect(states(steps)).toEqual(['published:done', 'offers:done', 'cancelled:cancelled']);
    expect(steps[2].at).toBe('2026-09-27T08:00:00.000Z');
  });

  it('keeps every step upcoming for drafts', () => {
    const steps = buildRequestTimeline(request({ status: 'draft', publishedAt: null }));
    expect(steps.every((step) => step.state === 'upcoming')).toBe(true);
  });
});

describe('seen offers', () => {
  afterEach(() => resetSeenOffers());

  it('reports offers newer than the last visit', () => {
    const item = request({ pendingOfferCount: 2, latestOfferAt: '2026-09-27T08:00:00.000Z' });
    const empty: SeenOffersMap = new Map();
    expect(hasUnseenOffers(item, empty)).toBe(true);
    expect(hasUnseenOffers(item, new Map([['req_1', '2026-09-27T08:00:00.000Z']]))).toBe(false);
    expect(hasUnseenOffers(item, new Map([['req_1', '2026-09-27T07:00:00.000Z']]))).toBe(true);
    expect(hasUnseenOffers({ ...item, pendingOfferCount: 0 }, empty)).toBe(false);
  });

  it('never moves the seen marker backwards', () => {
    markOffersSeen('req_1', '2026-09-27T08:00:00.000Z');
    const snapshot = getSeenOffers();
    markOffersSeen('req_1', '2026-09-27T07:00:00.000Z');
    markOffersSeen('req_1', null);
    expect(getSeenOffers()).toBe(snapshot);
    expect(getSeenOffers().get('req_1')).toBe('2026-09-27T08:00:00.000Z');
    const item = request({ pendingOfferCount: 1, latestOfferAt: '2026-09-27T08:00:00.000Z' });
    expect(hasUnseenOffers(item, getSeenOffers())).toBe(false);
    markOffersSeen('req_1', '2026-09-27T09:00:00.000Z');
    expect(getSeenOffers()).not.toBe(snapshot);
  });
});

describe('offer comparison', () => {
  function offer(id: string, overrides: Partial<OfferWithProfessional> = {}, pro: Partial<OfferWithProfessional['professional']> = {}) {
    return {
      id,
      price: 400,
      proposedStartAt: '2026-09-28T09:00:00.000Z',
      estimatedDurationMinutes: 60,
      distanceKm: 5,
      ...overrides,
      professional: { averageRating: 4.5, reviewCount: 10, yearsOfExperience: 5, completedJobsCount: 20, ...pro },
    };
  }

  it('shows every offer when the request stops accepting offers', () => {
    expect(offerStatusesForFilter('pending', true)).toEqual(['pending']);
    expect(offerStatusesForFilter('pending', false)).toBeUndefined();
    expect(offerStatusesForFilter('all', true)).toBeUndefined();
  });

  it('marks the best value per metric', () => {
    const best = getCompareBestIds([
      offer('a', { price: 350, distanceKm: 2 }, { averageRating: 4.9, reviewCount: 40 }),
      offer('b', { proposedStartAt: '2026-09-27T15:00:00.000Z', estimatedDurationMinutes: null }, { yearsOfExperience: 12 }),
      offer('c', { price: 350, estimatedDurationMinutes: 45 }, { completedJobsCount: 90, reviewCount: 0, averageRating: null }),
    ]);
    expect([...best.price].sort()).toEqual(['a', 'c']);
    expect([...best.start]).toEqual(['b']);
    expect([...best.duration]).toEqual(['c']);
    expect([...best.rating]).toEqual(['a']);
    expect([...best.reviews]).toEqual(['a']);
    expect([...best.experience]).toEqual(['b']);
    expect([...best.completedJobs]).toEqual(['c']);
    expect([...best.distance]).toEqual(['a']);
  });

  it('marks nothing when all values are equal or fewer than two are known', () => {
    const best = getCompareBestIds([offer('a'), offer('b')]);
    expect(best.price.size).toBe(0);
    const single = getCompareBestIds([offer('a', { estimatedDurationMinutes: 30 }), offer('b', { estimatedDurationMinutes: null })]);
    expect(single.duration.size).toBe(0);
  });
});
