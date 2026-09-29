import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { clearDatabase, createTestApp } from '../../../../test/app.js';
import { signInCustomer, signInProfessional } from '../../../../test/auth.js';
import { RAMAT_GAN } from '../../../../test/factories.js';
import { newObjectId } from '../../../lib/ids.js';
import { ConversationModel } from '../../conversations/conversation.model.js';
import { JobModel } from '../../jobs/job.model.js';
import { RequestModel } from '../../requests/request.model.js';
import { HOUR, eventTypes, postOffer, postRequest } from '../../requests/__tests__/marketplace-fixtures.js';
import { OfferModel } from '../offer.model.js';

describe('POST /v1/offers/:id/accept', () => {
  const { app, deps } = createTestApp();
  beforeEach(async () => {
    await clearDatabase();
    deps.realtime.clear();
  });

  async function requestWithOffers(count: number) {
    const customer = await signInCustomer(deps);
    const req = await postRequest(app, customer);
    const pros = [];
    const offers = [];
    for (let i = 0; i < count; i += 1) {
      const pro = await signInProfessional(deps, { center: i % 2 === 0 ? undefined : RAMAT_GAN });
      pros.push(pro);
      offers.push(await postOffer(app, deps, pro, req.id, { price: 300 + i * 10 }));
    }
    return { customer, req, pros, offers };
  }

  it('lets exactly one of many concurrent acceptances win (409 for the others)', async () => {
    const { customer, req, offers } = await requestWithOffers(4);
    const responses = await Promise.all(offers.map((offer) => request(app).post(`/v1/offers/${offer.id}/accept`).set(customer.headers)));
    const statuses = responses.map((res) => res.status).sort();
    expect(statuses).toEqual([200, 409, 409, 409]);
    for (const res of responses.filter((r) => r.status === 409)) expect(['CONFLICT', 'INVALID_STATE_TRANSITION']).toContain(res.body.code);

    const winner = responses.find((res) => res.status === 200)?.body.offer.id as string;
    expect(await JobModel.countDocuments({ request: req.id })).toBe(1);
    expect(await ConversationModel.countDocuments({ request: req.id })).toBe(1);
    expect(await OfferModel.countDocuments({ request: req.id, status: 'accepted' })).toBe(1);
    expect(await OfferModel.countDocuments({ request: req.id, status: 'rejected', statusReason: 'another_offer_accepted' })).toBe(3);
    const stored = await RequestModel.findById(req.id).lean();
    expect(stored).toMatchObject({ status: 'professional_selected', pendingOfferCount: 0, offerCount: 4 });
    expect(stored?.acceptedOffer?.toHexString()).toBe(winner);
  });

  it('answers the same request twice with 409 CONFLICT and never creates a second job', async () => {
    const { customer, offers } = await requestWithOffers(2);
    const [first, second] = offers;
    await request(app).post(`/v1/offers/${first?.id}/accept`).set(customer.headers).expect(200);
    const again = await request(app).post(`/v1/offers/${second?.id}/accept`).set(customer.headers).expect(409);
    expect(again.body.code).toBe('CONFLICT');
    const same = await request(app).post(`/v1/offers/${first?.id}/accept`).set(customer.headers).expect(409);
    expect(same.body.code).toBe('CONFLICT');
    expect(await JobModel.countDocuments({})).toBe(1);
  });

  it('refuses expired offers, withdrawn offers and closed requests with the mock’s codes', async () => {
    const { customer, req, pros, offers } = await requestWithOffers(3);
    const [expiring, withdrawn] = offers;
    await OfferModel.updateOne({ _id: expiring?.id }, { $set: { expiresAt: new Date(deps.clock.now().getTime() - HOUR) } });
    const expired = await request(app).post(`/v1/offers/${expiring?.id}/accept`).set(customer.headers).expect(409);
    expect(expired.body.code).toBe('OFFER_EXPIRED');

    await request(app).post(`/v1/offers/${withdrawn?.id}/withdraw`).set(pros[1]?.headers ?? {}).expect(200);
    const notPending = await request(app).post(`/v1/offers/${withdrawn?.id}/accept`).set(customer.headers).expect(409);
    expect(notPending.body.code).toBe('INVALID_STATE_TRANSITION');

    await request(app).post(`/v1/requests/${req.id}/cancel`).set(customer.headers).send({ reason: 'found_elsewhere' }).expect(200);
    await OfferModel.updateOne({ _id: offers[2]?.id }, { $set: { status: 'pending' } });
    const closed = await request(app).post(`/v1/offers/${offers[2]?.id}/accept`).set(customer.headers).expect(409);
    expect(closed.body.code).toBe('REQUEST_NOT_ACCEPTING_OFFERS');
  });

  it('checks ownership and roles', async () => {
    const { pros, offers } = await requestWithOffers(1);
    const stranger = await signInCustomer(deps);
    const forbidden = await request(app).post(`/v1/offers/${offers[0]?.id}/accept`).set(stranger.headers).expect(403);
    expect(forbidden.body.code).toBe('FORBIDDEN');
    await request(app).post(`/v1/offers/${offers[0]?.id}/accept`).set(pros[0]?.headers ?? {}).expect(403);
    await request(app).post(`/v1/offers/${newObjectId().toHexString()}/accept`).set(stranger.headers).expect(404);
    await request(app).post('/v1/offers/not-an-id/accept').set(stranger.headers).expect(404);
    await request(app).post(`/v1/offers/${offers[0]?.id}/accept`).expect(401);
  });

  it('removes the request from the explorers of matching professionals', async () => {
    const { customer, offers } = await requestWithOffers(1);
    const bystander = await signInProfessional(deps);
    deps.realtime.clear();
    await request(app).post(`/v1/offers/${offers[0]?.id}/accept`).set(customer.headers).expect(200);
    expect(eventTypes(deps, bystander.user._id.toHexString())).toEqual(['request.updated']);
    const nearby = await request(app).get('/v1/professional/requests/nearby').set(bystander.headers).expect(200);
    expect(nearby.body.totalCount).toBe(0);
  });
});
