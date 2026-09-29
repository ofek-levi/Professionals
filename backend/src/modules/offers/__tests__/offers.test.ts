import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { clearDatabase, createTestApp } from '../../../../test/app.js';
import { signInCustomer, signInProfessional } from '../../../../test/auth.js';
import { HAIFA, RAMAT_GAN } from '../../../../test/factories.js';
import { RequestModel } from '../../requests/request.model.js';
import { HOUR, inHours, notificationTypes, offerBody, postOffer, postRequest } from '../../requests/__tests__/marketplace-fixtures.js';
import { OfferModel } from '../offer.model.js';

describe('offers', () => {
  const { app, deps } = createTestApp();
  beforeEach(async () => {
    await clearDatabase();
    deps.realtime.clear();
  });

  async function setup(requestOverrides: Record<string, unknown> = {}) {
    const customer = await signInCustomer(deps);
    const pro = await signInProfessional(deps);
    const req = await postRequest(app, customer, requestOverrides);
    return { customer, pro, req };
  }

  describe('POST /v1/requests/:id/offers', () => {
    it('refuses duplicates, closed requests, other categories and areas with the mock’s codes', async () => {
      const { customer, pro, req } = await setup();
      await postOffer(app, deps, pro, req.id);
      const duplicate = await request(app).post(`/v1/requests/${req.id}/offers`).set(pro.headers).send(offerBody(deps)).expect(409);
      expect(duplicate.body.code).toBe('DUPLICATE_OFFER');

      const painter = await signInProfessional(deps, { professional: { categoryIds: ['painting'] } });
      const category = await request(app).post(`/v1/requests/${req.id}/offers`).set(painter.headers).send(offerBody(deps)).expect(422);
      expect(category.body).toMatchObject({ code: 'UNSUPPORTED_CATEGORY', fieldErrors: { categoryId: ['validation:category.notOffered'] } });

      const far = await signInProfessional(deps, { center: HAIFA });
      const area = await request(app).post(`/v1/requests/${req.id}/offers`).set(far.headers).send(offerBody(deps)).expect(422);
      expect(area.body).toMatchObject({ code: 'OUTSIDE_SERVICE_AREA', fieldErrors: { location: ['validation:location.outsideServiceArea'] } });

      const draft = await postRequest(app, customer, { publish: false });
      await request(app).post(`/v1/requests/${draft.id}/offers`).set(pro.headers).send(offerBody(deps)).expect(404);
      await request(app).post(`/v1/requests/${req.id}/cancel`).set(customer.headers).send({ reason: 'no_longer_needed' }).expect(200);
      const other = await signInProfessional(deps, { center: RAMAT_GAN });
      const closed = await request(app).post(`/v1/requests/${req.id}/offers`).set(other.headers).send(offerBody(deps)).expect(409);
      expect(closed.body.code).toBe('REQUEST_NOT_ACCEPTING_OFFERS');
    });

    it('lets only one of two concurrent submissions by the same professional through', async () => {
      const { pro, req } = await setup();
      const responses = await Promise.all([1, 2].map(() => request(app).post(`/v1/requests/${req.id}/offers`).set(pro.headers).send(offerBody(deps))));
      expect(responses.map((res) => res.status).sort()).toEqual([201, 409]);
      expect(responses.find((res) => res.status === 409)?.body.code).toBe('DUPLICATE_OFFER');
      expect(await OfferModel.countDocuments({ request: req.id })).toBe(1);
      expect((await RequestModel.findById(req.id).lean())?.pendingOfferCount).toBe(1);
    });

    it('validates the payload and the proposed time against the urgency', async () => {
      const { pro, req } = await setup({ urgency: 'emergency' });
      const invalid = await request(app)
        .post(`/v1/requests/${req.id}/offers`)
        .set(pro.headers)
        .send({ price: 10.555, currency: 'GBP', proposedStartAt: 'soon', estimatedDurationMinutes: 5, message: 'x'.repeat(501) })
        .expect(400);
      expect(invalid.body).toEqual({
        code: 'VALIDATION_ERROR',
        message: expect.any(String),
        fieldErrors: {
          price: ['validation:offer.priceTooLow'],
          currency: ['validation:offer.currencyUnsupported'],
          proposedStartAt: ['validation:offer.startInvalid'],
          estimatedDurationMinutes: ['validation:offer.durationInvalid'],
          message: ['validation:offer.messageTooLong'],
        },
      });
      const cases: [number, string][] = [
        [0.25, 'validation:offer.startTooSoon'],
        [30, 'validation:offer.emergencyWindow'],
        [61 * 24, 'validation:offer.startTooFar'],
      ];
      for (const [hours, message] of cases) {
        const res = await request(app).post(`/v1/requests/${req.id}/offers`).set(pro.headers).send(offerBody(deps, { proposedStartAt: inHours(deps, hours) })).expect(400);
        expect(res.body.fieldErrors).toEqual({ proposedStartAt: [message] });
      }
      const usd = await request(app).post(`/v1/requests/${req.id}/offers`).set(pro.headers).send(offerBody(deps, { currency: 'USD', proposedStartAt: inHours(deps, 3) })).expect(400);
      expect(usd.body.fieldErrors).toEqual({ currency: ['validation:offer.currencyUnsupported'] });
      const ok = await postOffer(app, deps, pro, req.id, { proposedStartAt: inHours(deps, 3) });
      // Emergency offers stay valid 6 h, but never past the proposed start.
      expect(ok.expiresAt).toBe(inHours(deps, 3));
    });
  });

  describe('PATCH /v1/offers/:id and withdraw', () => {
    it('edits a pending offer (expiry restarts) and notifies the customer', async () => {
      const { customer, pro, req } = await setup();
      const offer = await postOffer(app, deps, pro, req.id);
      deps.clock.advance(20 * 60_000);
      const change = { price: 420, message: '', proposedStartAt: inHours(deps, 100) };
      const res = await request(app).patch(`/v1/offers/${offer.id}`).set(pro.headers).send(change).expect(200);
      // Normal urgency: valid 72 h from the edit.
      expect(res.body).toMatchObject({ price: 420, message: null, status: 'pending', expiresAt: inHours(deps, 72) });
      expect(notificationTypes(deps, customer.user._id.toHexString())).toContain('offer_updated');
      const other = await signInProfessional(deps);
      await request(app).patch(`/v1/offers/${offer.id}`).set(other.headers).send({ price: 400 }).expect(403);
      await request(app).patch(`/v1/offers/${offer.id}`).set(customer.headers).send({ price: 400 }).expect(403);
    });

    it('refuses edits of expired or answered offers', async () => {
      const { pro, req } = await setup();
      const offer = await postOffer(app, deps, pro, req.id);
      await OfferModel.updateOne({ _id: offer.id }, { $set: { expiresAt: new Date(deps.clock.now().getTime() - 1000) } });
      const expired = await request(app).patch(`/v1/offers/${offer.id}`).set(pro.headers).send({ price: 400 }).expect(409);
      expect(expired.body.code).toBe('OFFER_EXPIRED');
      await OfferModel.updateOne({ _id: offer.id }, { $set: { status: 'rejected', expiresAt: new Date(deps.clock.now().getTime() + HOUR) } });
      const answered = await request(app).patch(`/v1/offers/${offer.id}`).set(pro.headers).send({ price: 400 }).expect(409);
      expect(answered.body.code).toBe('INVALID_STATE_TRANSITION');
    });

    it('withdraws: the request returns to open when no pending offer is left', async () => {
      const { customer, pro, req } = await setup();
      const offer = await postOffer(app, deps, pro, req.id);
      expect((await RequestModel.findById(req.id).lean())?.status).toBe('offers_received');
      const res = await request(app).post(`/v1/offers/${offer.id}/withdraw`).set(pro.headers).expect(200);
      expect(res.body).toMatchObject({ status: 'withdrawn', statusReason: 'withdrawn_by_professional' });
      expect(await RequestModel.findById(req.id).lean()).toMatchObject({ status: 'open', offerCount: 0, pendingOfferCount: 0 });
      expect(notificationTypes(deps, customer.user._id.toHexString())).toContain('offer_withdrawn');
      const again = await request(app).post(`/v1/offers/${offer.id}/withdraw`).set(pro.headers).expect(409);
      expect(again.body.code).toBe('INVALID_STATE_TRANSITION');
      // A new offer is allowed after withdrawing.
      await postOffer(app, deps, pro, req.id);
    });
  });

  describe('reads', () => {
    it('GET /offers/:id: the owner sees the exact address, the professional the approximate one', async () => {
      const { customer, pro, req } = await setup();
      const offer = await postOffer(app, deps, pro, req.id);
      const asCustomer = await request(app).get(`/v1/offers/${offer.id}`).set(customer.headers).expect(200);
      expect(asCustomer.body).toMatchObject({ id: offer.id, distanceKm: 0, professional: { id: pro.user._id.toHexString() }, request: { id: req.id } });
      expect(asCustomer.body.request.location.isApproximate).toBe(false);
      const asPro = await request(app).get(`/v1/offers/${offer.id}`).set(pro.headers).expect(200);
      expect(asPro.body.request.location).toMatchObject({ isApproximate: true, addressLine: '' });
      await request(app).get(`/v1/offers/${offer.id}`).set((await signInProfessional(deps)).headers).expect(403);
      await request(app).get(`/v1/offers/${offer.id}`).set((await signInCustomer(deps)).headers).expect(403);
    });

    it('GET /requests/:id/offers ranks like the app and pages with a stable cursor', async () => {
      const { customer, req } = await setup();
      const prices = [500, 300, 400];
      const offers = [];
      for (const price of prices) offers.push(await postOffer(app, deps, await signInProfessional(deps), req.id, { price }));
      await request(app).post(`/v1/offers/${offers[2]?.id}/withdraw`).set(customer.headers).expect(403);

      const byPrice = await request(app).get(`/v1/requests/${req.id}/offers?sort=lowest_price&limit=2`).set(customer.headers).expect(200);
      expect(byPrice.body.items.map((o: { price: number }) => o.price)).toEqual([300, 400]);
      expect(byPrice.body.totalCount).toBe(3);
      const next = await request(app).get(`/v1/requests/${req.id}/offers?sort=lowest_price&limit=2&cursor=${byPrice.body.nextCursor as string}`).set(customer.headers).expect(200);
      expect(next.body).toMatchObject({ items: [{ price: 500 }], nextCursor: null });

      const recommended = await request(app).get(`/v1/requests/${req.id}/offers`).set(customer.headers).expect(200);
      expect(recommended.body.items[0].price).toBe(300);
      const pendingOnly = await request(app).get(`/v1/requests/${req.id}/offers?statuses=accepted`).set(customer.headers).expect(200);
      expect(pendingOnly.body).toEqual({ items: [], nextCursor: null, totalCount: 0 });
      await request(app).get(`/v1/requests/${req.id}/offers?cursor=bogus`).set(customer.headers).expect(400);
      await request(app).get(`/v1/requests/${req.id}/offers`).set((await signInCustomer(deps)).headers).expect(403);
    });

    it('GET /professional/offers: newest update first, filtered by status, keyset pages', async () => {
      const customer = await signInCustomer(deps);
      const pro = await signInProfessional(deps);
      const ids: string[] = [];
      for (let i = 0; i < 3; i += 1) {
        const req = await postRequest(app, customer);
        ids.push((await postOffer(app, deps, pro, req.id)).id);
        deps.clock.advance(60_000);
      }
      await request(app).post(`/v1/offers/${ids[0] ?? ''}/withdraw`).set(pro.headers).expect(200);
      const first = await request(app).get('/v1/professional/offers?limit=2').set(pro.headers).expect(200);
      expect(first.body.items.map((o: { id: string }) => o.id)).toEqual([ids[0], ids[2]]);
      expect(first.body.items[0].request.location.isApproximate).toBe(true);
      const second = await request(app).get(`/v1/professional/offers?limit=2&cursor=${first.body.nextCursor as string}`).set(pro.headers).expect(200);
      expect(second.body).toMatchObject({ items: [{ id: ids[1] }], nextCursor: null, totalCount: 3 });
      const pending = await request(app).get('/v1/professional/offers?statuses=pending').set(pro.headers).expect(200);
      expect(pending.body.totalCount).toBe(2);
      await request(app).get('/v1/professional/offers').set(customer.headers).expect(403);
    });
  });
});
