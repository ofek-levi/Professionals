import { QueryClient, type QueryKey } from '@tanstack/react-query';

import { queryKeys } from '@/hooks/queries/query-keys';

import {
  invalidateConversation,
  invalidateJobGraph,
  invalidateNotifications,
  invalidateOfferGraph,
  invalidateOwnProfile,
  invalidateProfessional,
  invalidateRequestGraph,
} from '../invalidation';

const ME = 'user_me';
const OTHER = 'user_other';

/** Every key the helpers may touch, for two users. */
function allKeys(userId: string) {
  return {
    dashboardCustomer: queryKeys.dashboard.customer(userId),
    dashboardPro: queryKeys.dashboard.professional(userId),
    requestA: queryKeys.requests.detail(userId, 'req_a'),
    requestB: queryKeys.requests.detail(userId, 'req_b'),
    customerList: queryKeys.requests.customerList(userId, { section: 'has_offers', limit: 20 }),
    nearbyList: queryKeys.requests.nearby(userId, { limit: 20 }),
    nearbyMap: queryKeys.requests.nearbyMap(userId, { limit: 200 }),
    offersA: queryKeys.offers.forRequest(userId, 'req_a', { sort: 'recommended' }),
    offersB: queryKeys.offers.forRequest(userId, 'req_b'),
    offerDetail: queryKeys.offers.detail(userId, 'off_1'),
    otherOffer: queryKeys.offers.detail(userId, 'off_2'),
    proOffers: queryKeys.offers.professionalList(userId, { limit: 20 }),
    jobDetail: queryKeys.jobs.detail(userId, 'job_1'),
    otherJob: queryKeys.jobs.detail(userId, 'job_2'),
    jobsActive: queryKeys.jobs.list(userId, 'active'),
    conversations: queryKeys.conversations.list(userId),
    conversation: queryKeys.conversations.detail(userId, 'conv_1'),
    messages: queryKeys.conversations.messages(userId, 'conv_1'),
    notifications: queryKeys.notifications.list(userId, { limit: 20 }),
    unread: queryKeys.notifications.unreadCount(userId),
    me: queryKeys.auth.me(userId),
    customerProfile: queryKeys.customer.profile(userId),
    ownPro: queryKeys.professionals.own(userId),
    proProfile: queryKeys.professionals.profile(userId, 'pro_1'),
    proReviews: queryKeys.professionals.reviews(userId, 'pro_1', { limit: 20 }),
    proReviewsPreview: queryKeys.professionals.reviews(userId, 'pro_1', { limit: 3 }),
    otherProProfile: queryKeys.professionals.profile(userId, 'pro_2'),
  } satisfies Record<string, QueryKey>;
}

type KeyName = keyof ReturnType<typeof allKeys>;

function setup() {
  // Infinite gcTime: no garbage-collection timers left running after the test.
  const qc = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  for (const userId of [ME, OTHER]) {
    Object.values(allKeys(userId)).forEach((key) => qc.setQueryData(key, { seeded: true }));
  }
  const invalidated = (userId = ME): KeyName[] =>
    (Object.entries(allKeys(userId)) as [KeyName, QueryKey][])
      .filter(([, key]) => qc.getQueryState(key)?.isInvalidated)
      .map(([name]) => name)
      .sort();
  return { qc, invalidated };
}

const sorted = (names: KeyName[]) => [...names].sort();

describe('invalidation helpers', () => {
  it('invalidateRequestGraph refreshes one request, its offers, lists and dashboards', async () => {
    const { qc, invalidated } = setup();
    await invalidateRequestGraph(qc, ME, 'req_a');
    expect(invalidated()).toEqual(
      sorted(['requestA', 'offersA', 'customerList', 'nearbyList', 'nearbyMap', 'dashboardCustomer', 'dashboardPro']),
    );
    expect(invalidated(OTHER)).toEqual([]);
  });

  it('invalidateRequestGraph without an id refreshes every request detail', async () => {
    const { qc, invalidated } = setup();
    await invalidateRequestGraph(qc, ME);
    expect(invalidated()).toEqual(
      sorted(['requestA', 'requestB', 'customerList', 'nearbyList', 'nearbyMap', 'dashboardCustomer', 'dashboardPro']),
    );
  });

  it('invalidateOfferGraph refreshes the offer, offer lists and the request', async () => {
    const { qc, invalidated } = setup();
    await invalidateOfferGraph(qc, ME, { offerId: 'off_1', requestId: 'req_a' });
    expect(invalidated()).toEqual(
      sorted([
        'offerDetail',
        'proOffers',
        'offersA',
        'requestA',
        'customerList',
        'nearbyList',
        'nearbyMap',
        'dashboardCustomer',
        'dashboardPro',
      ]),
    );
  });

  it('invalidateJobGraph refreshes the job, job lists, the mirrored request and conversations', async () => {
    const { qc, invalidated } = setup();
    await invalidateJobGraph(qc, ME, { jobId: 'job_1', requestId: 'req_a' });
    expect(invalidated()).toEqual(
      sorted([
        'jobDetail',
        'jobsActive',
        'requestA',
        'customerList',
        'conversations',
        'conversation',
        'dashboardCustomer',
        'dashboardPro',
      ]),
    );
  });

  it('accepting an offer (offer + job graphs) refreshes request details, offers, dashboards and jobs', async () => {
    const { qc, invalidated } = setup();
    await Promise.all([
      invalidateOfferGraph(qc, ME, { offerId: 'off_1', requestId: 'req_a' }),
      invalidateJobGraph(qc, ME, { jobId: 'job_1', requestId: 'req_a' }),
    ]);
    const names = invalidated();
    (['requestA', 'offersA', 'dashboardCustomer', 'jobDetail', 'jobsActive', 'conversations'] as const).forEach((name) =>
      expect(names).toContain(name),
    );
    expect(names).not.toContain('requestB');
    expect(names).not.toContain('otherJob');
  });

  it('invalidateNotifications refreshes lists, the unread count and the pro dashboard', async () => {
    const { qc, invalidated } = setup();
    await invalidateNotifications(qc, ME);
    expect(invalidated()).toEqual(sorted(['notifications', 'unread', 'dashboardPro']));
  });

  it('invalidateConversation leaves messages alone unless asked', async () => {
    const { qc, invalidated } = setup();
    await invalidateConversation(qc, ME, 'conv_1');
    expect(invalidated()).toEqual(sorted(['conversations', 'conversation']));
    await invalidateConversation(qc, ME, 'conv_1', { includeMessages: true });
    expect(invalidated()).toContain('messages');
  });

  it('invalidateProfessional targets one professional', async () => {
    const { qc, invalidated } = setup();
    await invalidateProfessional(qc, ME, 'pro_1');
    expect(invalidated()).toEqual(sorted(['proProfile', 'proReviews', 'proReviewsPreview']));
  });

  it('invalidateOwnProfile refreshes identity, profiles, matching requests and dashboards', async () => {
    const { qc, invalidated } = setup();
    await invalidateOwnProfile(qc, ME);
    expect(invalidated()).toEqual(
      sorted([
        'me',
        'customerProfile',
        'ownPro',
        'proProfile',
        'proReviews',
        'proReviewsPreview',
        'otherProProfile',
        'nearbyList',
        'nearbyMap',
        'dashboardCustomer',
        'dashboardPro',
      ]),
    );
  });
});
