import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { clearDatabase, createTestApp } from '../../../../test/app.js';
import { accessTokenFor, bearer, signInCustomer, signInProfessional } from '../../../../test/auth.js';
import { RequestModel } from '../../requests/request.model.js';
import { HOUR, inHours, notificationTypes, postOffer, postRequest } from '../../requests/__tests__/marketplace-fixtures.js';
import { offerJobs } from '../offers.jobs.js';
import { expireOverdueOffers } from '../offer-expiry.service.js';
import { OfferModel } from '../offer.model.js';

describe('offer-expiry cron', () => {
  const { app, deps } = createTestApp();
  beforeEach(async () => {
    await clearDatabase();
    deps.realtime.clear();
  });

  it('expires overdue pending offers once, reopens the request and notifies the professional', async () => {
    const customer = await signInCustomer(deps);
    const pro = await signInProfessional(deps);
    const other = await signInProfessional(deps);
    const req = await postRequest(app, customer, { urgency: 'urgent' });
    // Urgent: valid 24 h; one offer starts sooner (its start caps the expiry).
    const early = await postOffer(app, deps, pro, req.id, { proposedStartAt: inHours(deps, 5) });
    const late = await postOffer(app, deps, other, req.id, { proposedStartAt: inHours(deps, 48) });
    expect(early.expiresAt).toBe(inHours(deps, 5));
    expect(late.expiresAt).toBe(inHours(deps, 24));

    deps.clock.advance(6 * HOUR);
    expect(await expireOverdueOffers(deps)).toBe(1);
    expect(await expireOverdueOffers(deps)).toBe(0);
    expect(await OfferModel.findById(early.id).lean()).toMatchObject({ status: 'expired', statusReason: 'expired' });
    expect(await RequestModel.findById(req.id).lean()).toMatchObject({ status: 'offers_received', pendingOfferCount: 1, offerCount: 2 });
    expect(notificationTypes(deps, pro.user._id.toHexString())).toEqual(['new_matching_request', 'offer_expired']);

    deps.clock.advance(20 * HOUR);
    const [job] = offerJobs(deps);
    expect(job?.name).toBe('offer-expiry');
    await job?.run();
    expect(await RequestModel.findById(req.id).lean()).toMatchObject({ status: 'open', pendingOfferCount: 0 });
    // An expired offer no longer blocks a new one (fresh token: the clock moved a day).
    await postOffer(app, deps, { headers: bearer(accessTokenFor(deps, pro.user)) }, req.id);
  });

  it('leaves offers alone that were answered meanwhile', async () => {
    const customer = await signInCustomer(deps);
    const pro = await signInProfessional(deps);
    const req = await postRequest(app, customer);
    const offer = await postOffer(app, deps, pro, req.id);
    await request(app).post(`/v1/offers/${offer.id}/withdraw`).set(pro.headers).expect(200);
    deps.clock.advance(100 * HOUR);
    expect(await expireOverdueOffers(deps)).toBe(0);
    expect((await OfferModel.findById(offer.id).lean())?.status).toBe('withdrawn');
  });
});
