import { DEMO_CUSTOMER_IDS, PRO_IDS, SEED_IDS } from '../data/seed';
import { createTestEnvironment, expectApiError, type TestEnvironment } from '../testing/test-server';

const NOA = DEMO_CUSTOMER_IDS.noa;
const LEAK = SEED_IDS.requests.noaLeak;
const O = SEED_IDS.offers;

describe('accepting an offer', () => {
  let env: TestEnvironment;
  beforeEach(async () => {
    env = await createTestEnvironment();
  });
  const db = () => env.server.internals.db;

  it('accepts one offer, rejects the others and creates the job and conversation', async () => {
    const result = await env.as(NOA).offers.acceptOffer(O.leakAvi);
    expect(result.offer).toMatchObject({ id: O.leakAvi, status: 'accepted', statusReason: 'accepted_by_customer' });
    expect(result.offer.respondedAt).not.toBeNull();
    expect(result.request).toMatchObject({
      id: LEAK,
      status: 'professional_selected',
      acceptedOfferId: O.leakAvi,
      jobId: result.job.id,
      pendingOfferCount: 0,
      offerCount: 3,
    });
    expect(result.job).toMatchObject({
      requestId: LEAK,
      offerId: O.leakAvi,
      customerId: NOA,
      professionalId: PRO_IDS.avi,
      status: 'awaiting_confirmation',
      agreedPrice: 650,
      scheduledStartAt: result.offer.proposedStartAt,
      categoryId: 'plumbing',
    });
    expect(result.job.location.isApproximate).toBe(false);
    expect(result.job).not.toHaveProperty('reminderSentAt');

    for (const id of [O.leakYossi, O.leakEli]) {
      expect(db().offers.require(id, 'Offer')).toMatchObject({ status: 'rejected', statusReason: 'another_offer_accepted' });
    }

    const conversation = await env.as(PRO_IDS.avi).conversations.getConversationById(result.job.conversationId);
    expect(conversation).toMatchObject({ jobId: result.job.id, requestId: LEAK, isOpen: true, unreadCount: 0, lastMessage: null });
    expect(conversation.participants.map((participant) => participant.userId).sort()).toEqual([NOA, PRO_IDS.avi].sort());

    const notifications = db().notifications.all();
    const accepted = notifications.filter((n) => n.type === 'offer_accepted' && n.userId === PRO_IDS.avi);
    expect(accepted).toHaveLength(1);
    expect(accepted[0].target).toEqual({ kind: 'job', jobId: result.job.id });
    for (const pro of [PRO_IDS.yossi, PRO_IDS.eli]) {
      expect(notifications.filter((n) => n.type === 'offer_not_selected' && n.userId === pro)).toHaveLength(1);
    }

    // The hired professional now sees the full address; the others still see the approximate one.
    const asAvi = await env.as(PRO_IDS.avi).requests.getRequestById(LEAK);
    expect(asAvi.request.location).toMatchObject({ isApproximate: false, addressLine: 'Florentin St 24' });
    expect(asAvi.request.jobId).toBe(result.job.id);
    const asYossi = await env.as(PRO_IDS.yossi).requests.getRequestById(LEAK);
    expect(asYossi.request.location).toMatchObject({ isApproximate: true, addressLine: '' });
    expect(asYossi.request.jobId).toBeNull();

    // Job lists pick it up for both parties.
    expect((await env.as(NOA).jobs.getJobs({ scope: 'active' })).map((job) => job.id)).toContain(result.job.id);
    expect((await env.as(PRO_IDS.avi).jobs.getActiveJobs()).map((job) => job.id)).toContain(result.job.id);
  });

  it('prevents a second acceptance on the same request', async () => {
    await env.as(NOA).offers.acceptOffer(O.leakAvi);
    const second = await expectApiError(env.as(NOA).offers.acceptOffer(O.leakYossi));
    expect(second).toMatchObject({ status: 409, code: 'CONFLICT' });
    const same = await expectApiError(env.as(NOA).offers.acceptOffer(O.leakAvi));
    expect(same).toMatchObject({ status: 409, code: 'CONFLICT' });
    expect(db().offers.filter((offer) => offer.requestId === LEAK && offer.status === 'accepted')).toHaveLength(1);
    expect(db().jobs.filter((job) => job.requestId === LEAK)).toHaveLength(1);
    expect(db().conversations.filter((conversation) => conversation.requestId === LEAK)).toHaveLength(1);
  });

  it('is atomic under concurrent acceptance attempts', async () => {
    const results = await Promise.allSettled([
      env.as(NOA).offers.acceptOffer(O.leakYossi),
      env.as(NOA).offers.acceptOffer(O.leakEli),
      env.as(NOA).offers.acceptOffer(O.leakAvi),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const accepted = db().offers.filter((offer) => offer.requestId === LEAK && offer.status === 'accepted');
    expect(accepted).toHaveLength(1);
    expect(db().requests.require(LEAK, 'Request').acceptedOfferId).toBe(accepted[0].id);
  });

  it('rejects expired offers', async () => {
    const offer = db().offers.require(O.leakAvi, 'Offer');
    env.clock.set(new Date(Date.parse(offer.expiresAt) + 60_000));
    const error = await expectApiError(env.as(NOA).offers.acceptOffer(O.leakAvi));
    expect(error).toMatchObject({ status: 409, code: 'OFFER_EXPIRED' });
  });

  it('only lets the request owner accept', async () => {
    expect(await expectApiError(env.as(PRO_IDS.avi).offers.acceptOffer(O.leakAvi))).toMatchObject({ status: 403, code: 'FORBIDDEN' });
    expect(await expectApiError(env.as(DEMO_CUSTOMER_IDS.daniel).offers.acceptOffer(O.leakAvi))).toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
    expect(db().requests.require(LEAK, 'Request').status).toBe('offers_received');
  });
});
