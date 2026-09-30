import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { clearDatabase, createTestApp } from '../../../../test/app.js';
import { signInCustomer, signInProfessional } from '../../../../test/auth.js';
import { RAMAT_GAN, TEL_AVIV } from '../../../../test/factories.js';
import { JPEG, PNG } from '../../../../test/images.js';
import { ConversationModel } from '../../conversations/conversation.model.js';
import { JobModel } from '../../jobs/job.model.js';
import { OfferModel } from '../../offers/offer.model.js';
import { acceptOffer, eventTypes, notificationTypes, postOffer, postRequest } from './marketplace-fixtures.js';

describe('POST /v1/requests/:id/cancel', () => {
  const { app, deps } = createTestApp();
  beforeEach(async () => {
    await clearDatabase();
    deps.realtime.clear();
    deps.storage.images.clear();
  });

  it('rejects pending offers, notifies their professionals, clears the explorers and deletes the photos', async () => {
    const customer = await signInCustomer(deps);
    const [pro, other, bystander] = [await signInProfessional(deps), await signInProfessional(deps, { center: RAMAT_GAN }), await signInProfessional(deps)];
    const req = await postRequest(app, customer, {}, TEL_AVIV, [JPEG, PNG]);
    expect(deps.storage.images.size).toBe(2);
    const offers = [await postOffer(app, deps, pro, req.id), await postOffer(app, deps, other, req.id)];
    await request(app).post(`/v1/offers/${offers[1]?.id ?? ''}/withdraw`).set(other.headers).expect(200);
    deps.realtime.clear();

    const res = await request(app).post(`/v1/requests/${req.id}/cancel`).set(customer.headers).send({ reason: 'found_elsewhere', comment: '  Neighbour fixed it ' }).expect(200);
    expect(res.body).toMatchObject({
      status: 'cancelled',
      cancellationReason: 'found_elsewhere',
      cancellationComment: 'Neighbour fixed it',
      cancelledAt: deps.clock.now().toISOString(),
      pendingOfferCount: 0,
      offerCount: 1,
      photos: [],
    });
    // The images go from storage after the commit (in the background).
    await deps.background.drain();
    expect(deps.storage.images.size).toBe(0);
    expect(await OfferModel.findById(offers[0]?.id).lean()).toMatchObject({ status: 'rejected', statusReason: 'request_cancelled' });
    expect(notificationTypes(deps, pro.user._id.toHexString())).toEqual(['request_cancelled']);
    // The withdrawn offer's professional is not notified, but still hears about the request.
    expect(notificationTypes(deps, other.user._id.toHexString())).toEqual([]);
    expect(eventTypes(deps, other.user._id.toHexString())).toEqual(['request.updated']);
    expect(eventTypes(deps, bystander.user._id.toHexString())).toEqual(['request.updated']);
    expect(eventTypes(deps, pro.user._id.toHexString())).toEqual(expect.arrayContaining(['offer.updated', 'request.updated']));

    const again = await request(app).post(`/v1/requests/${req.id}/cancel`).set(customer.headers).send({ reason: 'other' }).expect(409);
    expect(again.body.code).toBe('INVALID_STATE_TRANSITION');
  });

  it('cancels the assigned job and closes its chat', async () => {
    const customer = await signInCustomer(deps);
    const pro = await signInProfessional(deps);
    const req = await postRequest(app, customer);
    const accepted = await acceptOffer(app, customer, (await postOffer(app, deps, pro, req.id)).id);
    await request(app).post(`/v1/jobs/${accepted.job.id}/confirm`).set(pro.headers).expect(200);
    deps.realtime.clear();

    await request(app).post(`/v1/requests/${req.id}/cancel`).set(customer.headers).send({ reason: 'scheduling_conflict' }).expect(200);
    expect(await JobModel.findById(accepted.job.id).lean()).toMatchObject({ status: 'cancelled', cancelledAt: deps.clock.now() });
    expect((await ConversationModel.findById(accepted.job.conversationId).lean())?.isOpen).toBe(false);
    expect(notificationTypes(deps, pro.user._id.toHexString())).toEqual(['request_cancelled']);
    expect(eventTypes(deps, pro.user._id.toHexString())).toEqual(expect.arrayContaining(['job.updated', 'request.updated']));
    // The accepted offer stays accepted (the app reads it as "job cancelled").
    expect((await OfferModel.findOne({ request: req.id }).lean())?.status).toBe('accepted');
  });

  it('refuses in-progress work, other customers and invalid reasons (the photos stay)', async () => {
    const customer = await signInCustomer(deps);
    const pro = await signInProfessional(deps);
    const req = await postRequest(app, customer, {}, TEL_AVIV, [JPEG]);
    const accepted = await acceptOffer(app, customer, (await postOffer(app, deps, pro, req.id)).id);
    await request(app).post(`/v1/jobs/${accepted.job.id}/confirm`).set(pro.headers).expect(200);
    await request(app).post(`/v1/jobs/${accepted.job.id}/start`).set(pro.headers).expect(200);

    const inProgress = await request(app).post(`/v1/requests/${req.id}/cancel`).set(customer.headers).send({ reason: 'other' }).expect(409);
    expect(inProgress.body.code).toBe('INVALID_STATE_TRANSITION');
    await request(app).post(`/v1/requests/${req.id}/cancel`).set((await signInCustomer(deps)).headers).send({ reason: 'other' }).expect(403);
    const invalid = await request(app).post(`/v1/requests/${req.id}/cancel`).set(customer.headers).send({ reason: 'bored', comment: 'x'.repeat(301) }).expect(400);
    expect(invalid.body.fieldErrors).toEqual({ reason: ['validation:cancel.reasonRequired'], comment: ['validation:cancel.commentTooLong'] });
    // `account_deleted` is set by account deletion only, never picked by a customer.
    const reserved = await request(app).post(`/v1/requests/${req.id}/cancel`).set(customer.headers).send({ reason: 'account_deleted' }).expect(400);
    expect(reserved.body.fieldErrors).toEqual({ reason: ['validation:cancel.reasonRequired'] });
    await request(app).post(`/v1/requests/${req.id}/cancel`).set(pro.headers).send({ reason: 'other' }).expect(403);
    await deps.background.drain();
    expect(deps.storage.images.size).toBe(1);
  });
});
