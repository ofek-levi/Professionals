import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { clearDatabase, createTestApp } from '../../../../test/app.js';
import { signInCustomer, signInProfessional } from '../../../../test/auth.js';
import { createJob, createOffer, createRequest, HAIFA } from '../../../../test/factories.js';
import { HOUR, acceptOffer, postOffer, postRequest } from '../../requests/__tests__/marketplace-fixtures.js';

describe('dashboards', () => {
  // 2026-10-15 12:00 Israel time.
  const { app, deps } = createTestApp({ now: '2026-10-15T09:00:00.000Z' });
  beforeEach(clearDatabase);

  it('GET /customer/dashboard counts open requests and offers and previews jobs', async () => {
    const customer = await signInCustomer(deps);
    const [pro, other] = [await signInProfessional(deps), await signInProfessional(deps)];
    const withOffers = await postRequest(app, customer);
    await postOffer(app, deps, pro, withOffers.id);
    await postOffer(app, deps, other, withOffers.id);
    await postRequest(app, customer);
    await postRequest(app, customer, { publish: false });
    const hired = await postRequest(app, customer);
    const accepted = await acceptOffer(app, customer, (await postOffer(app, deps, pro, hired.id)).id);
    const doneReq = await createRequest(customer.user, { status: 'completed' });
    const done = await createJob(doneReq, await createOffer(doneReq, pro.professional, { status: 'accepted' }), { status: 'completed', completedAt: deps.clock.now() });

    const res = await request(app).get('/v1/customer/dashboard').set(customer.headers).expect(200);
    expect(res.body).toMatchObject({ openRequestsCount: 2, requestsWithOffersCount: 1, pendingOffersCount: 2, activeJobsCount: 1 });
    expect(res.body.recentRequests).toHaveLength(5);
    expect(res.body.recentRequests[0]).toHaveProperty('lowestOfferPrice');
    expect(res.body.upcomingJobs.map((job: { id: string }) => job.id)).toEqual([accepted.job.id]);
    expect(res.body.jobsAwaitingReview.map((job: { id: string }) => job.id)).toEqual([done._id.toHexString()]);
    await request(app).get('/v1/customer/dashboard').set(pro.headers).expect(403);
  });

  it('GET /professional/dashboard shows the explorer, pending offers, appointments and this month’s earnings', async () => {
    const customer = await signInCustomer(deps);
    const pro = await signInProfessional(deps);
    const offered = await postRequest(app, customer);
    await postRequest(app, customer, { categoryId: 'painting' });
    await postRequest(app, customer);
    deps.clock.advance(60_000);
    const fresh = await postRequest(app, customer);
    await postRequest(app, customer, {}, HAIFA);
    const offer = await postOffer(app, deps, pro, offered.id);

    const job = async (completedAt: string, price: number) => {
      const req = await createRequest(customer.user, { status: 'completed' });
      return createJob(req, await createOffer(req, pro.professional, { status: 'accepted', price }), { status: 'completed', completedAt: new Date(completedAt) });
    };
    await job('2026-10-01T08:00:00.000Z', 400); // 11:00 on Oct 1st in Israel: this month
    await job('2026-09-30T22:30:00.000Z', 250.5); // 01:30 on Oct 1st in Israel: this month
    await job('2026-09-30T20:00:00.000Z', 999); // 23:00 on Sep 30th in Israel: last month
    const upcomingReq = await createRequest(customer.user, { status: 'scheduled' });
    const upcoming = await createJob(upcomingReq, await createOffer(upcomingReq, pro.professional, { status: 'accepted', proposedStartAt: new Date(deps.clock.now().getTime() + 3 * HOUR) }));

    const res = await request(app).get('/v1/professional/dashboard').set(pro.headers).expect(200);
    expect(res.body).toMatchObject({
      nearbyOpenRequestsCount: 3,
      pendingOffersCount: 1,
      activeJobsCount: 1,
      earningsThisMonth: { amount: 650.5, currency: 'ILS' },
    });
    expect(res.body.newRequests[0]).toMatchObject({ id: fresh.id, notes: null });
    expect(res.body.newRequests.map((r: { id: string }) => r.id)).not.toContain(offered.id);
    expect(res.body.newRequests).toHaveLength(2);
    expect(res.body.pendingOffers.map((o: { id: string }) => o.id)).toEqual([offer.id]);
    expect(res.body.pendingOffers[0].request.location.isApproximate).toBe(true);
    expect(res.body.upcomingAppointments.map((j: { id: string }) => j.id)).toEqual([upcoming._id.toHexString()]);
    expect(res.body.recentNotifications.map((n: { type: string }) => n.type)).toContain('new_matching_request');
    expect(res.body.recentNotifications.length).toBeLessThanOrEqual(5);
    await request(app).get('/v1/professional/dashboard').set(customer.headers).expect(403);
  });
});
