/**
 * The whole marketplace lifecycle through HTTP: create → publish → match → offer → accept
 * (transaction) → confirm → start → complete → review → rating aggregate, with the side effects
 * (notifications, realtime events, push) each step owes.
 */
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { clearDatabase, createTestApp } from '../../../../test/app.js';
import { signInCustomer, signInProfessional } from '../../../../test/auth.js';
import { createDevice, HAIFA, RAMAT_GAN } from '../../../../test/factories.js';
import { ConversationModel } from '../../conversations/conversation.model.js';
import { OfferModel } from '../../offers/offer.model.js';
import { ProfessionalModel } from '../../professionals/professional.model.js';
import { RequestModel } from '../../requests/request.model.js';
import { eventTypes, notificationTypes, offerBody, requestBody } from '../../requests/__tests__/marketplace-fixtures.js';

describe('marketplace lifecycle (HTTP)', () => {
  const { app, deps } = createTestApp();
  beforeEach(async () => {
    await clearDatabase();
    deps.realtime.clear();
    deps.push.sent.length = 0;
  });

  it('runs a request from creation to a reviewed job', async () => {
    const customer = await signInCustomer(deps);
    const pro = await signInProfessional(deps);
    const rival = await signInProfessional(deps, { center: RAMAT_GAN });
    const faraway = await signInProfessional(deps, { center: HAIFA });
    const painter = await signInProfessional(deps, { professional: { categoryIds: ['painting'] } });
    await createDevice(pro.user);
    const customerId = customer.user._id.toHexString();
    const proId = pro.user._id.toHexString();
    const rivalId = rival.user._id.toHexString();

    // Create + publish in one step: matching professionals are notified (not Haifa, not painters).
    const created = await request(app).post('/v1/requests').set(customer.headers).send(requestBody()).expect(201);
    expect(created.body).toMatchObject({ status: 'open', customerId, offerCount: 0, latestOfferAt: null, lowestOfferPrice: null });
    const requestId = created.body.id as string;
    expect(notificationTypes(deps, proId)).toEqual(['new_matching_request']);
    expect(notificationTypes(deps, rivalId)).toEqual(['new_matching_request']);
    expect(notificationTypes(deps, faraway.user._id.toHexString())).toEqual([]);
    expect(notificationTypes(deps, painter.user._id.toHexString())).toEqual([]);
    expect(eventTypes(deps, proId)).toContain('request.updated');
    expect(deps.push.sent.length).toBeGreaterThan(0);

    // The explorer shows it with the privacy view.
    const nearby = await request(app).get('/v1/professional/requests/nearby').set(pro.headers).expect(200);
    expect(nearby.body.totalCount).toBe(1);
    expect(nearby.body.items[0]).toMatchObject({ id: requestId, notes: null, jobId: null, isMatch: true, myOffer: null });
    expect(nearby.body.items[0].distanceKm).toBeLessThanOrEqual(0.5); // to the public pin, 250–450 m off
    expect(nearby.body.items[0].location).toMatchObject({ addressLine: '', details: null, isApproximate: true });

    // Two offers → offers_received; the customer is notified of each.
    const offer = await request(app).post(`/v1/requests/${requestId}/offers`).set(pro.headers).send(offerBody(deps)).expect(201);
    expect(offer.body).toMatchObject({ status: 'pending', requestId, professionalId: proId, price: 350 });
    const rivalOffer = await request(app).post(`/v1/requests/${requestId}/offers`).set(rival.headers).send(offerBody(deps, { price: 300 })).expect(201);
    expect(notificationTypes(deps, customerId)).toEqual(['offer_received', 'offer_received']);
    const afterOffers = await request(app).get(`/v1/requests/${requestId}`).set(customer.headers).expect(200);
    expect(afterOffers.body).toMatchObject({ viewerRole: 'customer', request: { status: 'offers_received', offerCount: 2, pendingOfferCount: 2, lowestOfferPrice: 300 } });
    expect((await ProfessionalModel.findById(proId).lean())?.stats.responseTimeMinutes).toBe(1);

    // Accept: one transaction for offer, rivals, request, job and conversation.
    const accepted = await request(app).post(`/v1/offers/${offer.body.id as string}/accept`).set(customer.headers).expect(200);
    expect(accepted.body.offer).toMatchObject({ id: offer.body.id, status: 'accepted', statusReason: 'accepted_by_customer' });
    expect(accepted.body.request).toMatchObject({ status: 'professional_selected', acceptedOfferId: offer.body.id, pendingOfferCount: 0, offerCount: 2 });
    expect(accepted.body.job).toMatchObject({ status: 'awaiting_confirmation', agreedPrice: 350, customerId, professionalId: proId, requestId });
    expect(accepted.body.job.location.addressLine).toBe('Dizengoff St 120');
    const jobId = accepted.body.job.id as string;
    expect((await OfferModel.findById(rivalOffer.body.id).lean())?.status).toBe('rejected');
    expect(await ConversationModel.countDocuments({ job: jobId, isOpen: true })).toBe(1);
    expect(notificationTypes(deps, proId)).toContain('offer_accepted');
    expect(notificationTypes(deps, rivalId)).toContain('offer_not_selected');

    // The hired professional now sees the exact address and notes.
    const hiredView = await request(app).get(`/v1/requests/${requestId}`).set(pro.headers).expect(200);
    expect(hiredView.body.request).toMatchObject({ notes: 'Gate code 1234', jobId, location: { addressLine: 'Dizengoff St 120', isApproximate: false } });
    const rivalView = await request(app).get(`/v1/requests/${requestId}`).set(rival.headers).expect(200);
    expect(rivalView.body.request).toMatchObject({ notes: null, jobId: null, myOffer: { status: 'rejected' } });

    // Job lifecycle; the request status mirrors it.
    await request(app).post(`/v1/jobs/${jobId}/start`).set(pro.headers).expect(409);
    await request(app).post(`/v1/jobs/${jobId}/confirm`).set(customer.headers).expect(403);
    const confirmed = await request(app).post(`/v1/jobs/${jobId}/confirm`).set(pro.headers).expect(200);
    expect(confirmed.body).toMatchObject({ status: 'scheduled', confirmedAt: deps.clock.now().toISOString() });
    await request(app).post(`/v1/jobs/${jobId}/start`).set(pro.headers).expect(200);
    expect((await RequestModel.findById(requestId).lean())?.status).toBe('in_progress');
    await request(app).post(`/v1/jobs/${jobId}/review`).set(customer.headers).send({ rating: 5, comment: null }).expect(409);
    const completed = await request(app).post(`/v1/jobs/${jobId}/complete`).set(customer.headers).expect(200);
    expect(completed.body).toMatchObject({ status: 'completed', completedBy: 'customer' });
    expect(notificationTypes(deps, proId)).toContain('job_completed');
    expect(notificationTypes(deps, customerId)).toEqual(expect.arrayContaining(['job_confirmed', 'job_started']));
    expect((await RequestModel.findById(requestId).lean())?.status).toBe('completed');

    // Review → rating aggregate on the professional.
    const details = await request(app).get(`/v1/jobs/${jobId}`).set(customer.headers).expect(200);
    expect(details.body).toMatchObject({ canReview: true, review: null, request: { id: requestId, notes: 'Gate code 1234' } });
    const review = await request(app).post(`/v1/jobs/${jobId}/review`).set(customer.headers).send({ rating: 4, comment: '  Great work  ' }).expect(201);
    expect(review.body).toMatchObject({ jobId, rating: 4, comment: 'Great work', professionalId: proId, customerDisplayName: expect.stringMatching(/^Noa L\.$/) });
    const stats = (await ProfessionalModel.findById(proId).lean())?.stats;
    expect(stats).toMatchObject({ averageRating: 4, reviewCount: 1, completedJobsCount: 1 });
    expect(notificationTypes(deps, proId)).toContain('review_received');
    expect(eventTypes(deps, proId)).toContain('profile.updated');
    const reviewed = await request(app).get(`/v1/jobs/${jobId}`).set(pro.headers).expect(200);
    expect(reviewed.body).toMatchObject({ canReview: false, reviewId: review.body.id, review: { id: review.body.id } });
    await request(app).post(`/v1/jobs/${jobId}/review`).set(customer.headers).send({ rating: 5, comment: null }).expect(409);
  });
});
