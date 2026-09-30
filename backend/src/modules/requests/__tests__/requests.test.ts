import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { clearDatabase, createTestApp } from '../../../../test/app.js';
import { signInCustomer, signInProfessional } from '../../../../test/auth.js';
import { createUpload, HAIFA } from '../../../../test/factories.js';
import { haversineDistanceKm } from '../../../lib/geo.js';
import { newObjectId } from '../../../lib/ids.js';
import { UploadModel } from '../../uploads/upload.model.js';
import { RequestModel } from '../request.model.js';
import { eventTypes, notificationTypes, postRequest, requestBody } from './marketplace-fixtures.js';

describe('requests', () => {
  const { app, deps } = createTestApp();
  beforeEach(async () => {
    await clearDatabase();
    deps.realtime.clear();
  });

  describe('POST /v1/requests', () => {
    it('saves a draft without notifying anyone, then publishes it', async () => {
      const customer = await signInCustomer(deps);
      const pro = await signInProfessional(deps);
      const draft = await postRequest(app, customer, { publish: false, notes: '  ' });
      expect(draft).toMatchObject({ status: 'draft', publishedAt: null, notes: null, photos: [], location: { isApproximate: false } });
      expect(notificationTypes(deps, pro.user._id.toHexString())).toEqual([]);
      expect(eventTypes(deps, customer.user._id.toHexString())).toEqual(['request.updated']);

      const published = await request(app).post(`/v1/requests/${draft.id}/publish`).set(customer.headers).expect(200);
      expect(published.body).toMatchObject({ status: 'open', publishedAt: deps.clock.now().toISOString() });
      expect(notificationTypes(deps, pro.user._id.toHexString())).toEqual(['new_matching_request']);
      // Idempotent: a retry after a lost response gets the published request, nobody is notified twice.
      const again = await request(app).post(`/v1/requests/${draft.id}/publish`).set(customer.headers).expect(200);
      expect(again.body).toMatchObject({ id: draft.id, status: 'open', publishedAt: published.body.publishedAt });
      expect(notificationTypes(deps, pro.user._id.toHexString())).toEqual(['new_matching_request']);
      await request(app).post(`/v1/requests/${draft.id}/cancel`).set(customer.headers).send({ reason: 'no_longer_needed' }).expect(200);
      const cancelled = await request(app).post(`/v1/requests/${draft.id}/publish`).set(customer.headers).expect(409);
      expect(cancelled.body.code).toBe('INVALID_STATE_TRANSITION');
    });

    it('tells the customer how many professionals were notified (0 when none covers the area yet)', async () => {
      const customer = await signInCustomer(deps);
      await signInProfessional(deps);
      await signInProfessional(deps);
      const draft = await postRequest(app, customer, { publish: false });
      expect(draft.matchedProfessionalCount).toBeNull();
      deps.realtime.clear();
      await request(app).post(`/v1/requests/${draft.id}/publish`).set(customer.headers).expect(200);
      await deps.background.drain();
      // The app refetches on this event and shows the count.
      expect(eventTypes(deps, customer.user._id.toHexString())).toContain('request.updated');
      const details = await request(app).get(`/v1/requests/${draft.id}`).set(customer.headers).expect(200);
      expect(details.body.request.matchedProfessionalCount).toBe(2);

      const far = await postRequest(app, customer, {}, HAIFA);
      await deps.background.drain();
      const farDetails = await request(app).get(`/v1/requests/${far.id}`).set(customer.headers).expect(200);
      expect(farDetails.body.request.matchedProfessionalCount).toBe(0);
    });

    it('is idempotent with a clientRequestId: a retry returns the first request, photos included', async () => {
      const customer = await signInCustomer(deps);
      const pro = await signInProfessional(deps);
      const photo = await createUpload(customer.user);
      const body = requestBody({ clientRequestId: 'form-1', photoIds: [photo._id.toHexString()] });

      const first = await request(app).post('/v1/requests').set(customer.headers).send(body).expect(201);
      await deps.background.drain();
      // The response was lost: the app posts the same form again (its photo is attached by now).
      const retry = await request(app).post('/v1/requests').set(customer.headers).send(body).expect(201);
      expect(retry.body).toMatchObject({ id: first.body.id, photos: [{ id: photo._id.toHexString() }] });
      await deps.background.drain();
      expect(await RequestModel.countDocuments({})).toBe(1);
      expect(notificationTypes(deps, pro.user._id.toHexString())).toEqual(['new_matching_request']);

      // Concurrent double submit: one request.
      const twice = await Promise.all([1, 2].map(() => request(app).post('/v1/requests').set(customer.headers).send(requestBody({ clientRequestId: 'form-2' }))));
      expect(twice.map((res) => res.status)).toEqual([201, 201]);
      expect(twice[0]?.body.id).toBe(twice[1]?.body.id);
      // Another form (or another customer with the same id) creates its own request.
      await request(app).post('/v1/requests').set(customer.headers).send(requestBody({ clientRequestId: 'form-3' })).expect(201);
      await request(app).post('/v1/requests').set((await signInCustomer(deps)).headers).send(requestBody({ clientRequestId: 'form-1' })).expect(201);
      expect(await RequestModel.countDocuments({})).toBe(4);
      const invalid = await request(app).post('/v1/requests').set(customer.headers).send(requestBody({ clientRequestId: ' ' })).expect(400);
      expect(invalid.body.fieldErrors).toEqual({ clientRequestId: ['validation:invalid'] });
    });

    it('reports every invalid field with the app’s message keys', async () => {
      const customer = await signInCustomer(deps);
      const res = await request(app)
        .post('/v1/requests')
        .set(customer.headers)
        .send({ categoryId: 'plumbing', description: 'short', location: { coordinates: { latitude: 99, longitude: 0 }, addressLine: '', city: 'X', neighborhood: null, details: null }, urgency: 'soon', photoIds: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] })
        .expect(400);
      expect(res.body).toEqual({
        code: 'VALIDATION_ERROR',
        message: expect.any(String),
        fieldErrors: {
          description: ['validation:request.descriptionTooShort'],
          'location.coordinates': ['validation:location.coordinatesInvalid'],
          'location.addressLine': ['validation:location.addressRequired'],
          urgency: ['validation:request.urgencyRequired'],
          photoIds: ['validation:request.tooManyPhotos'],
        },
      });
      const unknown = await request(app).post('/v1/requests').set(customer.headers).send(requestBody({ categoryId: 'teleportation' })).expect(422);
      expect(unknown.body).toMatchObject({ code: 'UNSUPPORTED_CATEGORY', fieldErrors: { categoryId: ['validation:category.unsupported'] } });
    });

    it('checks the preferred date against today (Israel time) and the urgency window', async () => {
      const customer = await signInCustomer(deps);
      // Clock: 2026-10-01 12:00 in Israel.
      const cases: [string, string, string][] = [
        ['2026-09-30', 'normal', 'validation:request.preferredDateInPast'],
        ['2026-12-01', 'normal', 'validation:request.preferredDateTooFar'],
        ['2026-10-03', 'emergency', 'validation:request.preferredDateBeyondUrgency'],
        ['2026-10-02', 'normal', ''],
        ['2026-10-02', 'emergency', ''],
        ['2026-10-04', 'urgent', ''],
        ['2026-10-05', 'urgent', 'validation:request.preferredDateBeyondUrgency'],
      ];
      for (const [date, urgency, message] of cases) {
        const res = await request(app).post('/v1/requests').set(customer.headers).send(requestBody({ urgency, preferredSchedule: { date, timeWindow: 'morning' } }));
        if (message) expect(res.body.fieldErrors, `${date} ${urgency}`).toEqual({ 'preferredSchedule.date': [message] });
        else expect(res.status, `${date} ${urgency}`).toBe(201);
      }
      const invalid = await request(app).post('/v1/requests').set(customer.headers).send(requestBody({ preferredSchedule: { date: '2026-02-30', timeWindow: 'noon' } })).expect(400);
      expect(invalid.body.fieldErrors).toEqual({ 'preferredSchedule.date': ['validation:request.preferredDateInvalid'], 'preferredSchedule.timeWindow': ['validation:request.timeWindowInvalid'] });
    });

    it('attaches the customer’s own uploads as photos and refuses foreign ones', async () => {
      const customer = await signInCustomer(deps);
      const [a, b] = [await createUpload(customer.user), await createUpload(customer.user)];
      const foreign = await createUpload((await signInCustomer(deps)).user);
      const created = await postRequest(app, customer, { photoIds: [b._id.toHexString(), a._id.toHexString()] });
      expect(created.photos).toEqual([
        { id: b._id.toHexString(), url: b.url, width: 800, height: 600 },
        { id: a._id.toHexString(), url: a.url, width: 800, height: 600 },
      ]);
      expect(await UploadModel.countDocuments({ attachedAt: { $ne: null } })).toBe(2);
      for (const id of [foreign._id.toHexString(), a._id.toHexString(), 'nope']) {
        const res = await request(app).post('/v1/requests').set(customer.headers).send(requestBody({ photoIds: [id] })).expect(400);
        expect(res.body.fieldErrors).toEqual({ photoIds: ['validation:request.photoNotFound'] });
      }
      expect(await RequestModel.countDocuments({})).toBe(1);
    });
  });

  describe('drafts', () => {
    it('edits photos and fields of a draft (removed photos are released) and deletes it', async () => {
      const customer = await signInCustomer(deps);
      const [a, b, c] = [await createUpload(customer.user), await createUpload(customer.user), await createUpload(customer.user)];
      const draft = await postRequest(app, customer, { publish: false, photoIds: [a._id.toHexString(), b._id.toHexString()] });
      const res = await request(app)
        .patch(`/v1/requests/${draft.id}`)
        .set(customer.headers)
        .send({ description: 'A new, longer description of the leak.', photoIds: [b._id.toHexString(), c._id.toHexString()], urgency: 'flexible' })
        .expect(200);
      expect(res.body).toMatchObject({ description: 'A new, longer description of the leak.', urgency: 'flexible', status: 'draft' });
      expect(res.body.photos.map((photo: { id: string }) => photo.id)).toEqual([b._id.toHexString(), c._id.toHexString()]);
      expect((await UploadModel.findById(a._id).lean())?.attachedAt).toBeNull();

      const other = await signInCustomer(deps);
      await request(app).patch(`/v1/requests/${draft.id}`).set(other.headers).send({ urgency: 'urgent' }).expect(403);
      await request(app).delete(`/v1/requests/${draft.id}`).set(other.headers).expect(403);
      await request(app).delete(`/v1/requests/${draft.id}`).set(customer.headers).expect(200, { success: true });
      expect(await UploadModel.countDocuments({ attachedAt: null })).toBe(3);
      await request(app).delete(`/v1/requests/${draft.id}`).set(customer.headers).expect(404);
    });

    it('refuses to edit or delete published requests', async () => {
      const customer = await signInCustomer(deps);
      const open = await postRequest(app, customer);
      const edit = await request(app).patch(`/v1/requests/${open.id}`).set(customer.headers).send({ urgency: 'urgent' }).expect(409);
      expect(edit.body.code).toBe('CONFLICT');
      await request(app).delete(`/v1/requests/${open.id}`).set(customer.headers).expect(409);
    });
  });

  describe('GET /v1/requests/:id', () => {
    it('applies the role and privacy rules of the app', async () => {
      const customer = await signInCustomer(deps);
      const pro = await signInProfessional(deps);
      const req = await postRequest(app, customer);
      const draft = await postRequest(app, customer, { publish: false });

      const own = await request(app).get(`/v1/requests/${req.id}`).set(customer.headers).expect(200);
      expect(own.body).toMatchObject({ viewerRole: 'customer', request: { id: req.id, notes: 'Gate code 1234', latestOfferAt: null } });

      const asPro = await request(app).get(`/v1/requests/${req.id}`).set(pro.headers).expect(200);
      expect(asPro.body.viewerRole).toBe('professional');
      expect(asPro.body.request).toMatchObject({ notes: null, isMatch: true, myOffer: null, customer: { displayName: expect.stringMatching(/^Noa L\.$/) } });
      const shift = haversineDistanceKm(own.body.request.location.coordinates, asPro.body.request.location.coordinates);
      expect(shift).toBeGreaterThan(0.24);
      expect(shift).toBeLessThan(0.46);
      // Every professional sees the same approximate pin.
      const again = await request(app).get(`/v1/requests/${req.id}`).set((await signInProfessional(deps)).headers).expect(200);
      expect(again.body.request.location).toEqual(asPro.body.request.location);

      await request(app).get(`/v1/requests/${draft.id}`).set(pro.headers).expect(404);
      const far = await signInProfessional(deps, { center: HAIFA });
      await request(app).get(`/v1/requests/${req.id}`).set(far.headers).expect(403);
      await request(app).get(`/v1/requests/${req.id}`).set((await signInCustomer(deps)).headers).expect(403);
      await request(app).get(`/v1/requests/${newObjectId().toHexString()}`).set(customer.headers).expect(404);
      await request(app).get(`/v1/requests/${req.id}`).expect(401);
    });
  });

  describe('GET /v1/customer/requests', () => {
    it('lists the customer’s requests by section/status, newest update first, in keyset pages', async () => {
      const customer = await signInCustomer(deps);
      const ids: string[] = [];
      for (let i = 0; i < 5; i += 1) {
        ids.push((await postRequest(app, customer, { publish: i % 2 === 0 })).id);
        deps.clock.advance(60_000);
      }
      await postRequest(app, await signInCustomer(deps));
      const first = await request(app).get('/v1/customer/requests?limit=2').set(customer.headers).expect(200);
      expect(first.body.totalCount).toBe(5);
      expect(first.body.items.map((r: { id: string }) => r.id)).toEqual([ids[4], ids[3]]);
      // A request created meanwhile does not shift the next page.
      await postRequest(app, customer);
      const second = await request(app).get(`/v1/customer/requests?limit=2&cursor=${first.body.nextCursor as string}`).set(customer.headers).expect(200);
      expect(second.body.items.map((r: { id: string }) => r.id)).toEqual([ids[2], ids[1]]);

      const drafts = await request(app).get('/v1/customer/requests?section=drafts').set(customer.headers).expect(200);
      expect(drafts.body.totalCount).toBe(2);
      const openOnes = await request(app).get('/v1/customer/requests?statuses=open,offers_received&section=awaiting_offers').set(customer.headers).expect(200);
      expect(openOnes.body.totalCount).toBe(4);
      const bad = await request(app).get('/v1/customer/requests?limit=0&statuses=nope').set(customer.headers).expect(400);
      expect(bad.body.fieldErrors).toEqual({ limit: ['validation:invalid'], 'statuses.0': ['validation:invalid'] });
      const badCursor = await request(app).get('/v1/customer/requests?cursor=bm9wZQ').set(customer.headers).expect(400);
      expect(badCursor.body.fieldErrors).toEqual({ cursor: ['validation:invalid'] });
      await request(app).get('/v1/customer/requests').set((await signInProfessional(deps)).headers).expect(403);
    });
  });

  describe('rate limits', () => {
    const limited = createTestApp({ env: { RATE_LIMIT_ENABLED: 'true' } });

    it('caps new requests per customer', async () => {
      const customer = await signInCustomer(limited.deps);
      for (let i = 0; i < 30; i += 1) await request(limited.app).post('/v1/requests').set(customer.headers).send({}).expect(400);
      const res = await request(limited.app).post('/v1/requests').set(customer.headers).send(requestBody()).expect(429);
      expect(res.body.code).toBe('RATE_LIMITED');
      // Other customers are not affected.
      await request(limited.app).post('/v1/requests').set((await signInCustomer(limited.deps)).headers).send(requestBody()).expect(201);
    });
  });
});
