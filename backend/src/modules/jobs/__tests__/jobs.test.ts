import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { clearDatabase, createTestApp } from '../../../../test/app.js';
import { signInCustomer, signInProfessional } from '../../../../test/auth.js';
import { createJob, createOffer, createRequest } from '../../../../test/factories.js';
import { ProfessionalModel } from '../../professionals/professional.model.js';
import { HOUR, notificationTypes } from '../../requests/__tests__/marketplace-fixtures.js';
import type { JobDoc } from '../job.model.js';

describe('jobs', () => {
  const { app, deps } = createTestApp();
  beforeEach(async () => {
    await clearDatabase();
    deps.realtime.clear();
  });

  async function pair() {
    return { customer: await signInCustomer(deps), pro: await signInProfessional(deps) };
  }

  /** A job between the pair starting `hours` from now. */
  async function job(parties: Awaited<ReturnType<typeof pair>>, hours: number, overrides: Partial<JobDoc> = {}) {
    const req = await createRequest(parties.customer.user, { status: 'scheduled' });
    const offer = await createOffer(req, parties.pro.professional, { status: 'accepted', proposedStartAt: new Date(deps.clock.now().getTime() + hours * HOUR) });
    return createJob(req, offer, overrides);
  }

  const ids = (body: { items: { id: string }[] }) => body.items.map((item) => item.id);
  const hex = (doc: JobDoc) => doc._id.toHexString();

  it('GET /jobs lists each scope in its order, for both parties, in keyset pages', async () => {
    const parties = await pair();
    const later = await job(parties, 48);
    const soon = await job(parties, 5, { status: 'awaiting_confirmation' });
    const started = await job(parties, -3, { status: 'in_progress' });
    const stale = await job(parties, -5, { status: 'scheduled' });
    const doneOld = await job(parties, -72, { status: 'completed', completedAt: new Date(deps.clock.now().getTime() - 48 * HOUR) });
    const doneNew = await job(parties, -24, { status: 'completed', completedAt: new Date(deps.clock.now().getTime() - HOUR) });
    await job(await pair(), 5);

    for (const caller of [parties.customer, parties.pro]) {
      const active = await request(app).get('/v1/jobs?scope=active').set(caller.headers).expect(200);
      expect(ids(active.body)).toEqual([stale, started, soon, later].map(hex));
      const upcoming = await request(app).get('/v1/jobs?scope=upcoming').set(caller.headers).expect(200);
      expect(ids(upcoming.body)).toEqual([soon, later].map(hex));
      const completed = await request(app).get('/v1/jobs?scope=completed').set(caller.headers).expect(200);
      expect(ids(completed.body)).toEqual([doneNew, doneOld].map(hex));
      const all = await request(app).get('/v1/jobs?limit=4').set(caller.headers).expect(200);
      const rest = await request(app).get(`/v1/jobs?limit=4&cursor=${all.body.nextCursor as string}`).set(caller.headers).expect(200);
      expect([...ids(all.body), ...ids(rest.body)]).toEqual([later, soon, started, stale, doneNew, doneOld].map(hex));
      expect(all.body.totalCount).toBe(6);
    }
    const summary = (await request(app).get('/v1/jobs?scope=upcoming').set(parties.pro.headers).expect(200)).body.items[0];
    expect(summary).toMatchObject({
      description: expect.any(String),
      professional: { id: parties.pro.user._id.toHexString() },
      customer: { id: parties.customer.user._id.toHexString(), displayName: expect.stringMatching(/^Noa L\.$/) },
      location: { addressLine: 'Dizengoff St 120', isApproximate: false },
    });
    await request(app).get('/v1/jobs?scope=soon').set(parties.pro.headers).expect(400);
  });

  it('GET /jobs/:id is for the parties only', async () => {
    const parties = await pair();
    const doc = await job(parties, 5);
    await request(app).get(`/v1/jobs/${hex(doc)}`).set(parties.customer.headers).expect(200);
    const asPro = await request(app).get(`/v1/jobs/${hex(doc)}`).set(parties.pro.headers).expect(200);
    expect(asPro.body).toMatchObject({ id: hex(doc), canReview: false, review: null, request: { notes: 'Code 1234' } });
    const others = await pair();
    await request(app).get(`/v1/jobs/${hex(doc)}`).set(others.customer.headers).expect(403);
    await request(app).get(`/v1/jobs/${hex(doc)}`).set(others.pro.headers).expect(403);
    await request(app).get('/v1/jobs/000000000000000000000000').set(others.pro.headers).expect(404);
  });

  it('the professional completes: the customer is notified and the completed count is refreshed', async () => {
    const parties = await pair();
    const doc = await job(parties, 5);
    await request(app).post(`/v1/jobs/${hex(doc)}/complete`).set((await pair()).pro.headers).expect(403);
    const res = await request(app).post(`/v1/jobs/${hex(doc)}/complete`).set(parties.pro.headers).expect(200);
    expect(res.body).toMatchObject({ status: 'completed', completedBy: 'professional', completedAt: deps.clock.now().toISOString() });
    expect(notificationTypes(deps, parties.customer.user._id.toHexString())).toEqual(['job_completed']);
    expect((await ProfessionalModel.findById(parties.pro.user._id).lean())?.stats.completedJobsCount).toBe(1);
    const twice = await request(app).post(`/v1/jobs/${hex(doc)}/complete`).set(parties.customer.headers).expect(409);
    expect(twice.body.code).toBe('INVALID_STATE_TRANSITION');
  });

  it('confirm and start follow the job state machine', async () => {
    const parties = await pair();
    const doc = await job(parties, 5, { status: 'awaiting_confirmation' });
    await request(app).post(`/v1/jobs/${hex(doc)}/confirm`).set((await pair()).pro.headers).expect(403);
    await request(app).post(`/v1/jobs/${hex(doc)}/complete`).set(parties.customer.headers).expect(409);
    await request(app).post(`/v1/jobs/${hex(doc)}/confirm`).set(parties.pro.headers).expect(200);
    const again = await request(app).post(`/v1/jobs/${hex(doc)}/confirm`).set(parties.pro.headers).expect(409);
    expect(again.body.code).toBe('INVALID_STATE_TRANSITION');
    await request(app).post(`/v1/jobs/${hex(doc)}/start`).set(parties.customer.headers).expect(403);
  });
});
