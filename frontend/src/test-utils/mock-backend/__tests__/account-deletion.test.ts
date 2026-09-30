import { isJobActive } from '@/features/jobs/job-status-machine';
import type { RegisterRequest } from '@/types/api';

import { MAIN_CUSTOMER_IDS, PRO_IDS, SEED_IDS } from '../data/seed';
import { buildMockGoogleIdToken } from '../server/google-id-token';
import { SEED_CUSTOMER_EMAIL, SEED_PASSWORD } from '../server/passwords';
import { createTestEnvironment, expectApiError, type TestEnvironment } from '../testing/test-server';

const NOA = MAIN_CUSTOMER_IDS.noa;

function customerRequest(overrides: Partial<RegisterRequest> = {}): RegisterRequest {
  return {
    role: 'customer',
    firstName: 'Tal',
    lastName: 'Harel',
    email: 'tal.harel@example.org',
    phone: '0501234567',
    password: 'Secret123',
    googleIdToken: null,
    acceptedTerms: true,
    preferredLanguage: 'en',
    professional: null,
    ...overrides,
  };
}

describe('account deletion', () => {
  let env: TestEnvironment;
  const db = () => env.server.internals.db;

  beforeEach(async () => {
    env = await createTestEnvironment();
  });

  it('previews what a customer’s deletion cancels', async () => {
    const impact = await env.as(NOA).users.getDeletionImpact();
    const own = db().requests.filter((request) => request.customerId === NOA);
    const active = own.filter((request) =>
      ['open', 'offers_received', 'professional_selected', 'scheduled', 'in_progress'].includes(request.status),
    );
    const jobs = db().jobs.filter((job) => job.customerId === NOA && isJobActive(job.status));
    expect(impact).toMatchObject({
      role: 'customer',
      reauthentication: { password: true, google: false },
      requestsToCancel: { count: active.length },
      offersToDecline: active.reduce((sum, request) => sum + request.pendingOfferCount, 0),
      draftsToDelete: own.filter((request) => request.status === 'draft').length,
      jobsToCancel: { count: jobs.length },
    });
    if (impact.role !== 'customer') return;
    expect(impact.offersToDecline).toBeGreaterThan(0);
    // The request with a hired professional names them; one nobody was hired for names nobody.
    expect(impact.requestsToCancel.items.find((item) => item.id === SEED_IDS.requests.noaLighting)).toMatchObject({
      status: 'professional_selected',
      counterpartName: expect.any(String),
    });
    expect(impact.requestsToCancel.items.find((item) => item.id === SEED_IDS.requests.noaAc)?.counterpartName).toBeNull();
    expect(impact.jobsToCancel.items[0]).toMatchObject({ id: SEED_IDS.jobs.noaLighting, requestId: SEED_IDS.requests.noaLighting });
  });

  it('previews a professional’s pending offers and active jobs', async () => {
    const avi = db().professionals.require(PRO_IDS.avi, 'Professional');
    const leakOffer = db().offers.require(SEED_IDS.offers.leakAvi, 'Offer');
    const impact = await env.as(PRO_IDS.avi).users.getDeletionImpact();
    expect(impact).toMatchObject({
      role: 'professional',
      offersToWithdraw: { count: db().offers.count((offer) => offer.professionalId === avi.id && offer.status === 'pending') },
      jobsToCancel: { count: db().jobs.count((job) => job.professionalId === avi.id && isJobActive(job.status)) },
    });
    if (impact.role !== 'professional') return;
    expect(impact.offersToWithdraw.items).toContainEqual(
      expect.objectContaining({ id: leakOffer.id, requestId: SEED_IDS.requests.noaLeak, status: 'pending', counterpartName: 'Noa L.' }),
    );
  });

  it('refuses without the right password (400, never 401) and changes nothing', async () => {
    const noa = env.as(NOA);
    expect(await expectApiError(noa.users.deleteAccount({}))).toMatchObject({
      status: 400,
      fieldErrors: { password: ['validation:auth.passwordRequired'] },
    });
    expect(await expectApiError(noa.users.deleteAccount({ password: 'wrong-password1' }))).toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      fieldErrors: { password: ['validation:auth.passwordIncorrect'] },
    });
    // A password account has no Google account to confirm with.
    expect(
      await expectApiError(
        noa.users.deleteAccount({
          googleIdToken: buildMockGoogleIdToken({ email: SEED_CUSTOMER_EMAIL, firstName: 'Noa', lastName: 'Levi' }),
        }),
      ),
    ).toMatchObject({
      status: 400,
      fieldErrors: { password: ['validation:auth.passwordRequired'] },
    });
    await expect(noa.users.getCurrentUser()).resolves.toMatchObject({ user: { id: NOA } });
    expect(db().requests.require(SEED_IDS.requests.noaLeak, 'Request').status).toBe('offers_received');
  });

  it('deletes a customer: cancels what is in progress, keeps an anonymous record and frees the email', async () => {
    const yael = PRO_IDS.yael;
    const leakPros = [PRO_IDS.avi, PRO_IDS.yossi, PRO_IDS.eli];
    await expect(env.as(NOA).users.deleteAccount({ password: SEED_PASSWORD })).resolves.toEqual({ success: true });

    // Signed out everywhere: a second submit (or any request) is the usual 401.
    expect(await expectApiError(env.as(NOA).users.deleteAccount({ password: SEED_PASSWORD }))).toMatchObject({ status: 401 });
    expect(await expectApiError(env.as(null).auth.login({ email: SEED_CUSTOMER_EMAIL, password: SEED_PASSWORD }))).toMatchObject({
      status: 401,
      code: 'INVALID_CREDENTIALS',
    });

    expect(db().requests.get(SEED_IDS.requests.noaDraft)).toBeUndefined();
    for (const id of [SEED_IDS.requests.noaAc, SEED_IDS.requests.noaLeak, SEED_IDS.requests.noaLighting]) {
      expect(db().requests.require(id, 'Request')).toMatchObject({
        status: 'cancelled',
        cancellationReason: 'account_deleted',
        photos: [],
      });
    }
    for (const offerId of [SEED_IDS.offers.leakAvi, SEED_IDS.offers.leakYossi, SEED_IDS.offers.leakEli]) {
      expect(db().offers.require(offerId, 'Offer')).toMatchObject({ status: 'rejected', statusReason: 'request_cancelled' });
    }
    expect(db().jobs.require(SEED_IDS.jobs.noaLighting, 'Job').status).toBe('cancelled');
    expect(
      db()
        .conversations.filter((conversation) => conversation.participants.some((p) => p.userId === NOA))
        .every((c) => !c.isOpen),
    ).toBe(true);
    // Kept requests lose the exact place and the notes.
    expect(db().requests.require(SEED_IDS.requests.noaWardrobe, 'Request')).toMatchObject({
      notes: null,
      location: { addressLine: '', details: null, isApproximate: true },
    });

    // The professionals are told, without a name.
    for (const userId of [...leakPros, yael]) {
      const notifications = await env.as(userId).notifications.getNotifications();
      expect(notifications.items[0]).toMatchObject({ type: 'request_cancelled', params: { customerName: '' } });
    }

    // Shown as "Deleted user" wherever the others meet the customer.
    const job = await env.as(yael).jobs.getJobById(SEED_IDS.jobs.noaLighting);
    expect(job.customer).toMatchObject({ displayName: 'Deleted user', accountDeleted: true, avatarUrl: null });
    const conversation = await env.as(yael).conversations.getConversationById(SEED_IDS.conversations.noaLighting);
    expect(conversation.isOpen).toBe(false);
    expect(conversation.participants.find((participant) => participant.userId === NOA)).toMatchObject({
      displayName: 'Deleted user',
      accountDeleted: true,
    });
    const reviews = await env.as(PRO_IDS.dana).professionals.getProfessionalReviews(PRO_IDS.dana);
    expect(reviews.items.find((review) => review.id === SEED_IDS.reviews.noaWardrobe)).toMatchObject({
      rating: expect.any(Number),
      comment: null,
      customerDisplayName: 'Deleted user',
      customerAccountDeleted: true,
    });

    // The email can open a new account.
    await expect(
      env.as(null).auth.register(customerRequest({ email: SEED_CUSTOMER_EMAIL, firstName: 'Noa', lastName: 'Levi' })),
    ).resolves.toMatchObject({
      user: { email: SEED_CUSTOMER_EMAIL },
    });
  });

  it('deletes a professional: withdraws offers, cancels jobs (job_cancelled) and leaves search and review', async () => {
    const yael = PRO_IDS.yael;
    await env.as(yael).users.deleteAccount({ password: SEED_PASSWORD });

    const job = db().jobs.require(SEED_IDS.jobs.noaLighting, 'Job');
    expect(job.status).toBe('cancelled');
    expect(db().requests.require(SEED_IDS.requests.noaLighting, 'Request')).toMatchObject({
      status: 'cancelled',
      cancellationReason: 'account_deleted',
    });
    const [latest] = (await env.as(NOA).notifications.getNotifications()).items;
    expect(latest).toMatchObject({ type: 'job_cancelled', target: { kind: 'job', jobId: job.id } });
    expect(latest.params).not.toHaveProperty('professionalName');
    expect(db().offers.filter((offer) => offer.professionalId === yael && offer.status === 'pending')).toEqual([]);

    const details = await env.as(NOA).jobs.getJobById(job.id);
    expect(details.professional).toMatchObject({ displayName: 'Deleted user', accountDeleted: true });
    expect(await expectApiError(env.as(NOA).professionals.getProfessionalProfile(yael))).toMatchObject({ status: 404 });
    expect(await expectApiError(env.as(NOA).professionals.getProfessionalReviews(yael))).toMatchObject({ status: 404 });
    const search = await env.as(NOA).professionals.searchProfessionals({ limit: 100 });
    expect(search.items.map((professional) => professional.id)).not.toContain(yael);
  });

  it('ends reviews of a deleted professional’s completed jobs', async () => {
    const moshe = PRO_IDS.moshe;
    expect((await env.as(NOA).jobs.getJobById(SEED_IDS.jobs.noaDishwasher)).canReview).toBe(true);
    await env.as(moshe).users.deleteAccount({ password: SEED_PASSWORD });

    expect((await env.as(NOA).jobs.getJobById(SEED_IDS.jobs.noaDishwasher)).canReview).toBe(false);
    const dashboard = await env.as(NOA).dashboard.getCustomerDashboard();
    expect(dashboard.jobsAwaitingReview.map((awaiting) => awaiting.id)).not.toContain(SEED_IDS.jobs.noaDishwasher);
    expect(await expectApiError(env.as(NOA).jobs.createReview(SEED_IDS.jobs.noaDishwasher, { rating: 5, comment: null }))).toMatchObject({
      status: 409,
    });
  });

  it('confirms a Google-only account with a token of its own Google account', async () => {
    const maya = { email: 'maya.katz@gmail.com', firstName: 'Maya', lastName: 'Katz' };
    const idToken = buildMockGoogleIdToken(maya);
    const session = await env.as(null).auth.register(customerRequest({ ...maya, password: null, googleIdToken: idToken }));
    const account = env.as(session.user.id).users;

    expect(await account.getDeletionImpact()).toMatchObject({ reauthentication: { password: false, google: true } });
    expect(await expectApiError(account.deleteAccount({ password: 'Secret123' }))).toMatchObject({
      status: 400,
      fieldErrors: { googleIdToken: ['validation:required'] },
    });
    const otherAccount = buildMockGoogleIdToken({ email: 'someone.else@gmail.com', firstName: 'Some', lastName: 'One' });
    expect(await expectApiError(account.deleteAccount({ googleIdToken: otherAccount }))).toMatchObject({
      status: 400,
      fieldErrors: { googleIdToken: ['validation:invalid'] },
    });
    await expect(account.deleteAccount({ googleIdToken: idToken })).resolves.toEqual({ success: true });

    // The Google account is free again: it signs up anew.
    await expect(env.as(null).auth.signInWithGoogle({ idToken })).resolves.toMatchObject({ status: 'registration_required' });
  });
});
