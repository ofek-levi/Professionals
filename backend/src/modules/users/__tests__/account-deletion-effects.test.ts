import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { clearDatabase, createTestApp } from '../../../../test/app.js';
import { signInCustomer, signInProfessional, type SignedInCustomer, type SignedInProfessional } from '../../../../test/auth.js';
import { createJob, createOffer, createPushSession, createRequest, createSession } from '../../../../test/factories.js';
import { JPEG, withForm } from '../../../../test/images.js';
import { ConversationModel } from '../../conversations/conversation.model.js';
import { EmailTokenModel } from '../../auth/email-token.model.js';
import { hashPassword } from '../../auth/passwords.js';
import { STRONG_PASSWORD } from '../../auth/__tests__/auth-test-helpers.js';
import { JobModel, type JobDoc } from '../../jobs/job.model.js';
import { NotificationModel } from '../../notifications/notification.model.js';
import { OfferModel } from '../../offers/offer.model.js';
import { ProfessionalModel, type ProfessionalDoc } from '../../professionals/professional.model.js';
import { RequestModel, type RequestDoc } from '../../requests/request.model.js';
import { ReviewModel } from '../../reviews/review.model.js';
import { notificationTypes, requestBody } from '../../requests/__tests__/marketplace-fixtures.js';
import { UserModel } from '../user.model.js';

const HOUR = 60 * 60_000;

describe('account deletion: what changes for everyone', () => {
  const { app, deps } = createTestApp({ now: '2026-10-01T09:00:00.000Z' });
  let passwordHash = '';
  beforeAll(async () => {
    passwordHash = await hashPassword(STRONG_PASSWORD);
  });
  beforeEach(async () => {
    await clearDatabase();
    deps.realtime.clear();
    deps.storage.images.clear();
    deps.push.sent.length = 0;
  });
  const inHours = (hours: number) => new Date(deps.clock.now().getTime() + hours * HOUR);
  const deleteAccount = (caller: { headers: Record<string, string> }) =>
    request(app).post('/v1/me/deletion').set(caller.headers).send({ password: STRONG_PASSWORD }).expect(200);

  /** The request's accepted offer and its job, linked as an acceptance links them. */
  async function hire(request_: RequestDoc, professional: Pick<ProfessionalDoc, '_id'>, job: Partial<JobDoc> = {}, message: string | null = null) {
    const offer = await createOffer(request_, professional, { status: 'accepted', message });
    const created = await createJob(request_, offer, job);
    await RequestModel.updateOne({ _id: request_._id }, { $set: { acceptedOffer: offer._id, job: created._id } });
    return created;
  }

  async function photo(folder = 'requests') {
    const image = await deps.storage.upload({ buffer: JPEG, mimeType: 'image/jpeg', folder });
    return { url: image.url, publicId: image.publicId };
  }

  /** A job that went through the API up to `completed`, and its review. */
  async function reviewedJob(customer: SignedInCustomer, pro: SignedInProfessional, comment: string) {
    const done = await createRequest(customer.user, { status: 'completed', photos: [await photo()], clientRequestId: 'client-1' });
    const job = await hire(done, pro.professional, { status: 'completed', completedAt: deps.clock.now() }, 'On my way');
    await request(app).post(`/v1/jobs/${job._id.toHexString()}/review`).set(customer.headers).send({ rating: 4, comment }).expect(201);
    return { done, job };
  }

  it("customer: closes their requests and jobs, tells the professionals, anonymises what the professionals keep", async () => {
    const avatar = await photo('avatars');
    const customer = await signInCustomer(deps, { passwordHash, firstName: 'Noa', lastName: 'Levi', avatar });
    const [pro, other] = [await signInProfessional(deps), await signInProfessional(deps)];
    await createPushSession(pro.user);
    await createSession(customer.user);
    await EmailTokenModel.create({ user: customer.user._id, purpose: 'verify_email', tokenHash: 'hash', expiresAt: inHours(48) });
    await NotificationModel.create({ user: customer.user._id, type: 'offer_received', params: {}, target: { kind: 'none' }, readAt: null });

    const draft = await createRequest(customer.user, { status: 'draft', photos: [await photo()] });
    const open = await createRequest(customer.user, { status: 'offers_received', photos: [await photo()], pendingOfferCount: 2 });
    const [pending, otherPending] = [await createOffer(open, pro.professional), await createOffer(open, other.professional)];
    const scheduled = await createRequest(customer.user, { status: 'scheduled' });
    const scheduledJob = await hire(scheduled, other.professional);
    const started = await createRequest(customer.user, { status: 'in_progress' });
    const startedJob = await hire(started, pro.professional, { status: 'in_progress' });
    const { done, job: doneJob } = await reviewedJob(customer, pro, 'Great work, call me on 050-1234567');
    deps.realtime.clear();
    deps.push.sent.length = 0;

    await deleteAccount(customer);
    await deps.background.drain();

    expect(await RequestModel.exists({ _id: draft._id })).toBeNull();
    expect(await RequestModel.findById(open._id).lean()).toMatchObject({ status: 'cancelled', cancellationReason: 'account_deleted', pendingOfferCount: 0 });
    expect(await OfferModel.findById(pending._id).lean()).toMatchObject({ status: 'rejected', statusReason: 'request_cancelled' });
    expect(await OfferModel.findById(otherPending._id).lean()).toMatchObject({ status: 'rejected' });
    for (const [job, request_] of [
      [scheduledJob, scheduled],
      [startedJob, started],
    ] as const) {
      expect(await JobModel.findById(job._id).lean()).toMatchObject({ status: 'cancelled', cancelledAt: deps.clock.now() });
      expect(await RequestModel.findById(request_._id).lean()).toMatchObject({ status: 'cancelled', cancellationReason: 'account_deleted' });
    }
    // The completed job stays; every chat (the completed job's too) is closed.
    expect((await JobModel.findById(doneJob._id).lean())?.status).toBe('completed');
    expect(await ConversationModel.countDocuments({ 'participants.user': customer.user._id, isOpen: true })).toBe(0);

    // Professionals are told, without the deleted name.
    expect(notificationTypes(deps, pro.user._id.toHexString())).toEqual(['request_cancelled', 'request_cancelled']);
    expect(notificationTypes(deps, other.user._id.toHexString())).toEqual(['request_cancelled', 'request_cancelled']);
    const stored = await NotificationModel.find({ user: pro.user._id, type: 'request_cancelled' }).lean();
    expect(stored.map((notification) => notification.params.customerName)).toEqual(['', '']);
    // The professional's push is in Hebrew: "…cancelled by a customer".
    expect(deps.push.sent.map((push) => push.body)).toEqual(Array(2).fill('הבקשה בנושא אינסטלציה בוטלה על ידי לקוח.'));

    // What professionals keep: the request without the exact address, notes, comment or photos.
    const kept = await RequestModel.findById(done._id).lean();
    expect(kept).toMatchObject({ description: done.description, categoryId: 'plumbing', status: 'completed', notes: null, photos: [] });
    expect(kept?.location).toEqual({ ...done.location, point: done.publicPoint, addressLine: '', details: null });
    expect(kept?.clientRequestId).toBeUndefined();
    expect(await ReviewModel.findOne({ job: doneJob._id }).lean()).toMatchObject({ rating: 4, comment: null });
    // Every image of the account left storage (drafts, cancelled and completed requests, the avatar).
    expect(deps.storage.images.size).toBe(0);

    // The account: a tombstone without personal data, signed out, nothing addressed to it.
    const tombstone = await UserModel.findById(customer.user._id).lean();
    expect(tombstone).toMatchObject({ role: 'customer', language: 'en', firstName: '', lastName: '', phone: '', avatar: null, defaultLocation: null });
    expect(tombstone?.email).toMatch(/^deleted-[0-9a-f]{24}-[0-9a-f]{12}@deleted\.invalid$/);
    expect(tombstone).not.toHaveProperty('passwordHash');
    expect(tombstone).not.toHaveProperty('emailVerifiedAt');
    expect(Object.values(tombstone?.notificationPreferences ?? {})).toEqual(Array(6).fill(false));
    expect(await NotificationModel.countDocuments({ user: customer.user._id })).toBe(0);
    expect(await EmailTokenModel.countDocuments({ user: customer.user._id })).toBe(0);

    // The professionals' screens still work, showing "Deleted user".
    const jobs = await request(app).get('/v1/jobs').set(pro.headers).expect(200);
    expect(jobs.body.items.map((item: { customer: unknown }) => item.customer)).toEqual(
      Array(2).fill(expect.objectContaining({ displayName: 'Deleted user', avatarUrl: null, accountDeleted: true })),
    );
    const job = await request(app).get(`/v1/jobs/${doneJob._id.toHexString()}`).set(pro.headers).expect(200);
    expect(job.body.location).toMatchObject({ addressLine: '', details: null });
    const chats = await request(app).get('/v1/conversations').set(pro.headers).expect(200);
    expect(chats.body.items[0].participants).toEqual(
      expect.arrayContaining([expect.objectContaining({ role: 'customer', displayName: 'Deleted user', accountDeleted: true })]),
    );
    const reviews = await request(app).get(`/v1/professionals/${pro.user._id.toHexString()}/reviews`).set(other.headers).expect(200);
    expect(reviews.body.items).toEqual([expect.objectContaining({ rating: 4, comment: null, customerDisplayName: 'Deleted user', customerAccountDeleted: true })]);
    const offers = await request(app).get('/v1/professional/offers').set(other.headers).expect(200);
    expect(offers.body.items).toHaveLength(2);
    const details = await request(app).get(`/v1/requests/${open._id.toHexString()}`).set(pro.headers).expect(200);
    expect(details.body.request.customer).toMatchObject({ displayName: 'Deleted user', accountDeleted: true });
  });

  it('professional: withdraws their offers, cancels their jobs (in progress too), tells the customers, leaves every search', async () => {
    const customer = await signInCustomer(deps);
    await createPushSession(customer.user);
    const pro = await signInProfessional(deps, { user: { passwordHash, avatar: await photo('avatars') }, professional: { displayName: 'Avi Fix' } });
    const open = await createRequest(customer.user, { status: 'offers_received', pendingOfferCount: 1 });
    const pending = await createOffer(open, pro.professional, { message: 'I can come today' });
    const overdue = await createOffer(await createRequest(customer.user, { status: 'offers_received', pendingOfferCount: 1 }), pro.professional, {
      expiresAt: inHours(-2),
    });
    const hired = await createRequest(customer.user, { status: 'professional_selected', photos: [await photo()] });
    const awaiting = await hire(hired, pro.professional, { status: 'awaiting_confirmation' });
    const started = await createRequest(customer.user, { status: 'in_progress' });
    const inProgress = await hire(started, pro.professional, { status: 'in_progress' });
    const { done: doneRequest, job: doneJob } = await reviewedJob(customer, pro, 'Tidy work');
    deps.realtime.clear();

    await deleteAccount(pro);
    await deps.background.drain();

    for (const offer of [pending, overdue]) {
      expect(await OfferModel.findById(offer._id).lean()).toMatchObject({ status: 'withdrawn', statusReason: 'withdrawn_by_professional', message: null });
    }
    expect(await RequestModel.findById(open._id).lean()).toMatchObject({ status: 'open', pendingOfferCount: 0 });
    for (const [job, request_] of [
      [awaiting, hired],
      [inProgress, started],
    ] as const) {
      expect((await JobModel.findById(job._id).lean())?.status).toBe('cancelled');
      expect(await RequestModel.findById(request_._id).lean()).toMatchObject({ status: 'cancelled', cancellationReason: 'account_deleted', photos: [] });
    }
    expect(await OfferModel.countDocuments({ professional: pro.user._id, message: { $ne: null } })).toBe(0);
    expect(notificationTypes(deps, customer.user._id.toHexString()).sort()).toEqual(['job_cancelled', 'job_cancelled', 'offer_withdrawn', 'offer_withdrawn']);
    const withdrawn = await NotificationModel.findOne({ user: customer.user._id, type: 'offer_withdrawn' }).lean();
    expect(withdrawn?.params.professionalName).toBe('');
    expect(deps.push.sent.map((push) => push.title)).toEqual(expect.arrayContaining(['Job cancelled', 'Offer withdrawn']));
    // The avatar and the cancelled request's photo go; the customer's completed request keeps its own.
    expect([...deps.storage.images.keys()]).toEqual(doneRequest.photos.map((kept) => kept.publicId));

    const tombstone = await ProfessionalModel.findById(pro.user._id).lean();
    expect(tombstone).toMatchObject({
      displayName: 'Deleted user',
      headline: '',
      categoryIds: [],
      baseLocation: null,
      contact: { phone: '', email: '', website: null },
      startingPrice: null,
      deletedAt: deps.clock.now(),
    });
    expect(tombstone?.serviceArea.center).toEqual(pro.professional.serviceArea.publicCenter);
    // Stats stay (they are part of the customers' history and the offer lists).
    expect(tombstone?.stats.reviewCount).toBe(1);

    // Gone from the public side, still in the customer's history.
    const proId = pro.user._id.toHexString();
    await request(app).get(`/v1/professionals/${proId}`).set(customer.headers).expect(404);
    await request(app).get(`/v1/professionals/${proId}/reviews`).set(customer.headers).expect(404);
    for (const query of [{}, { categoryId: 'plumbing' }, { lat: 32.0853, lng: 34.7818 }, { categoryId: 'plumbing', lat: 32.0853, lng: 34.7818 }]) {
      const found = await request(app).get('/v1/professionals').query(query).set(customer.headers).expect(200);
      expect(found.body.items, JSON.stringify(query)).toEqual([]);
    }
    const offers = await request(app).get(`/v1/requests/${open._id.toHexString()}/offers`).set(customer.headers).expect(200);
    expect(offers.body.items[0].professional).toMatchObject({ displayName: 'Deleted user', accountDeleted: true });
    const done = await request(app).get(`/v1/jobs/${doneJob._id.toHexString()}`).set(customer.headers).expect(200);
    expect(done.body).toMatchObject({ status: 'completed', canReview: false, professional: { displayName: 'Deleted user', accountDeleted: true } });
    const dashboard = await request(app).get('/v1/customer/dashboard').set(customer.headers).expect(200);
    expect(dashboard.body.jobsAwaitingReview).toEqual([]);
  });

  it('refuses a deleted account whose access token is still valid, and takes no review for a deleted professional', async () => {
    const customer = await signInCustomer(deps, { passwordHash });
    const pro = await signInProfessional(deps, { user: { passwordHash } });
    const openRequest = await createRequest(customer.user);
    const done = await createRequest(customer.user, { status: 'completed' });
    const doneJob = await hire(done, pro.professional, { status: 'completed' });
    // These tokens name no stored session, so revoking the sessions does not deny them.
    await deleteAccount(pro);

    const offer = { price: 350, currency: 'ILS', proposedStartAt: inHours(48).toISOString(), estimatedDurationMinutes: 90, message: null };
    await request(app).post(`/v1/requests/${openRequest._id.toHexString()}/offers`).set(pro.headers).send(offer).expect(401);
    await request(app).get('/v1/me').set(pro.headers).expect(401);
    await request(app).patch('/v1/me').set(pro.headers).send({ preferredLanguage: 'he' }).expect(401);
    await request(app).delete('/v1/me/avatar').set(pro.headers).expect(401);
    await request(app).patch('/v1/professional/profile').set(pro.headers).send({ headline: 'Back again' }).expect(404);
    expect((await ProfessionalModel.findById(pro.user._id).lean())?.headline).toBe('');
    const review = await request(app).post(`/v1/jobs/${doneJob._id.toHexString()}/review`).set(customer.headers).send({ rating: 1 }).expect(409);
    expect(review.body.message).toMatch(/deleted/);

    await deleteAccount(customer);
    await withForm(request(app).post('/v1/requests').set(customer.headers), requestBody()).expect(401);
    await request(app).patch('/v1/customer/profile').set(customer.headers).send({ firstName: 'Noa' }).expect(404);
    expect((await UserModel.findById(customer.user._id).lean())?.firstName).toBe('');
  });
});
