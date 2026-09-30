import { APP_CONFIG } from '@/constants/app-config';

import { MAIN_CUSTOMER_IDS, PRO_IDS, SEED_IDS } from '../data/seed';
import { createTestEnvironment, minutesFromNow, type TestEnvironment } from '../testing/test-server';

const NOA = MAIN_CUSTOMER_IDS.noa;

describe('scheduled tasks', () => {
  let env: TestEnvironment;
  beforeEach(async () => {
    env = await createTestEnvironment();
  });
  const db = () => env.server.internals.db;
  const ofType = (userId: string, type: string) =>
    db().notifications.filter((notification) => notification.userId === userId && notification.type === type);

  it('expires overdue offers, notifies the professional and reopens the request', async () => {
    const leakOffers = db().offers.filter((offer) => offer.requestId === SEED_IDS.requests.noaLeak);
    const latestExpiry = Math.max(...leakOffers.map((offer) => Date.parse(offer.expiresAt)));
    const aviExpiredBefore = ofType(PRO_IDS.avi, 'offer_expired').length;

    env.clock.set(new Date(latestExpiry + 60_000));
    // Any request triggers the scheduler.
    const request = await env.as(NOA).requests.getRequestById(SEED_IDS.requests.noaLeak);

    expect(request.request).toMatchObject({ status: 'open', pendingOfferCount: 0, offerCount: 3 });
    for (const offer of leakOffers) {
      expect(db().offers.require(offer.id, 'Offer')).toMatchObject({ status: 'expired', statusReason: 'expired' });
    }
    expect(ofType(PRO_IDS.avi, 'offer_expired')).toHaveLength(aviExpiredBefore + 1);
    expect(ofType(PRO_IDS.avi, 'offer_expired').some((n) => n.target.kind === 'offer' && n.target.offerId === SEED_IDS.offers.leakAvi)).toBe(
      true,
    );

    // Running again changes nothing.
    await env.as(NOA).requests.getRequestById(SEED_IDS.requests.noaLeak);
    expect(ofType(PRO_IDS.avi, 'offer_expired')).toHaveLength(aviExpiredBefore + 1);

    // An expired offer does not block a new one.
    const renewed = await env.as(PRO_IDS.avi).offers.createOffer(SEED_IDS.requests.noaLeak, {
      price: 600,
      currency: 'ILS',
      proposedStartAt: minutesFromNow(env, 24 * 60),
      estimatedDurationMinutes: 120,
      message: null,
    });
    expect(renewed.status).toBe('pending');
    expect(db().requests.require(SEED_IDS.requests.noaLeak, 'Request').status).toBe('offers_received');
  });

  it('keeps the request in offers_received while other offers are still pending', async () => {
    const yossi = db().offers.require(SEED_IDS.offers.leakYossi, 'Offer');
    const others = [SEED_IDS.offers.leakAvi, SEED_IDS.offers.leakEli].map((id) => Date.parse(db().offers.require(id, 'Offer').expiresAt));
    // With the test clock, Yossi's same-day appointment makes his offer expire first.
    expect(Date.parse(yossi.expiresAt)).toBeLessThan(Math.min(...others));
    env.clock.set(new Date(Date.parse(yossi.expiresAt) + 1000));
    const { request } = await env.as(NOA).requests.getRequestById(SEED_IDS.requests.noaLeak);
    expect(db().offers.require(SEED_IDS.offers.leakYossi, 'Offer').status).toBe('expired');
    expect(request).toMatchObject({ status: 'offers_received', pendingOfferCount: 2 });
  });

  it('sends one appointment reminder to both parties shortly before the job', async () => {
    const job = db().jobs.require(SEED_IDS.jobs.noaLighting, 'Job');
    const start = Date.parse(job.scheduledStartAt);

    env.clock.set(new Date(start - (APP_CONFIG.appointmentReminderLeadMinutes + 30) * 60_000));
    await env.as(NOA).notifications.getUnreadCount();
    expect(ofType(NOA, 'appointment_reminder')).toHaveLength(0);

    env.clock.set(new Date(start - (APP_CONFIG.appointmentReminderLeadMinutes - 10) * 60_000));
    await env.as(NOA).notifications.getUnreadCount();
    const [customerReminder] = ofType(NOA, 'appointment_reminder');
    expect(customerReminder).toMatchObject({
      params: { professionalName: 'BrightSpark Electric', scheduledAt: job.scheduledStartAt },
      target: { kind: 'job', jobId: job.id },
    });
    expect(ofType(PRO_IDS.yael, 'appointment_reminder')[0].params).toMatchObject({ customerName: 'Noa L.' });

    env.clock.advanceMinutes(30);
    await env.as(NOA).notifications.getUnreadCount();
    expect(ofType(NOA, 'appointment_reminder')).toHaveLength(1);
    expect(ofType(PRO_IDS.yael, 'appointment_reminder')).toHaveLength(1);
  });
});
