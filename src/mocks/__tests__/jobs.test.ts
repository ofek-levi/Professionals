import { DEMO_CUSTOMER_IDS, PRO_IDS, SEED_IDS } from '../data/seed';
import { computeProfessionalStats } from '../server/services/review-service';
import { createTestEnvironment, expectApiError, type TestEnvironment } from '../testing/test-server';

const NOA = DEMO_CUSTOMER_IDS.noa;
const J = SEED_IDS.jobs;

describe('jobs', () => {
  let env: TestEnvironment;
  beforeEach(async () => {
    env = await createTestEnvironment();
  });
  const db = () => env.server.internals.db;
  const requestStatus = (jobId: string) => db().requests.require(db().jobs.require(jobId, 'Job').requestId, 'Request').status;
  const lastNotification = (userId: string) =>
    db()
      .notifications.filter((notification) => notification.userId === userId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
      .pop();

  it('runs the full lifecycle: confirm → start → complete, mirrored on the request', async () => {
    const yael = env.as(PRO_IDS.yael).jobs;
    expect((await expectApiError(yael.startJob(J.noaLighting))).code).toBe('INVALID_STATE_TRANSITION');
    expect((await expectApiError(yael.completeJob(J.noaLighting))).code).toBe('INVALID_STATE_TRANSITION');

    const confirmed = await yael.confirmJob(J.noaLighting);
    expect(confirmed.status).toBe('scheduled');
    expect(confirmed.confirmedAt).not.toBeNull();
    expect(requestStatus(J.noaLighting)).toBe('scheduled');
    expect(lastNotification(NOA)).toMatchObject({ type: 'job_confirmed', target: { kind: 'job', jobId: J.noaLighting } });
    expect((await expectApiError(yael.confirmJob(J.noaLighting))).code).toBe('INVALID_STATE_TRANSITION');

    const started = await yael.startJob(J.noaLighting);
    expect(started.status).toBe('in_progress');
    expect(requestStatus(J.noaLighting)).toBe('in_progress');
    expect(lastNotification(NOA)?.type).toBe('job_started');

    const before = db().professionals.require(PRO_IDS.yael, 'Pro').stats.completedJobsCount;
    const completed = await env.as(NOA).jobs.completeJob(J.noaLighting);
    expect(completed).toMatchObject({ status: 'completed', completedBy: 'customer' });
    expect(requestStatus(J.noaLighting)).toBe('completed');
    expect(lastNotification(PRO_IDS.yael)).toMatchObject({ type: 'job_completed', params: { customerName: 'Noa L.' } });
    expect(db().professionals.require(PRO_IDS.yael, 'Pro').stats.completedJobsCount).toBe(before + 1);
    expect(db().customerProfiles.require(NOA, 'Customer').stats.completedJobsCount).toBe(3);

    const details = await env.as(NOA).jobs.getJobById(J.noaLighting);
    expect(details.canReview).toBe(true);
    expect((await env.as(PRO_IDS.yael).jobs.getJobById(J.noaLighting)).canReview).toBe(false);
  });

  it('lets the professional complete a scheduled job directly', async () => {
    await env.as(PRO_IDS.yael).jobs.confirmJob(J.noaLighting);
    const completed = await env.as(PRO_IDS.yael).jobs.completeJob(J.noaLighting);
    expect(completed).toMatchObject({ status: 'completed', completedBy: 'professional' });
    expect(lastNotification(NOA)?.type).toBe('job_completed');
  });

  it('enforces job ownership and roles', async () => {
    expect(await expectApiError(env.as(PRO_IDS.omer).jobs.confirmJob(J.noaLighting))).toMatchObject({ status: 403 });
    expect(await expectApiError(env.as(NOA).jobs.confirmJob(J.noaLighting))).toMatchObject({ status: 403, code: 'FORBIDDEN' });
    expect(await expectApiError(env.as(DEMO_CUSTOMER_IDS.daniel).jobs.completeJob(J.noaLighting))).toMatchObject({ status: 403 });
    expect(await expectApiError(env.as(DEMO_CUSTOMER_IDS.daniel).jobs.getJobById(J.noaLighting))).toMatchObject({ status: 403 });
    expect(await expectApiError(env.as(NOA).jobs.getJobById('job_missing'))).toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it('lists jobs by scope', async () => {
    const noa = env.as(NOA).jobs;
    expect((await noa.getJobs({ scope: 'active' })).map((job) => job.id)).toEqual([J.noaLighting]);
    expect((await noa.getJobs({ scope: 'upcoming' })).map((job) => job.id)).toEqual([J.noaLighting]);
    expect((await noa.getJobs({ scope: 'completed' })).map((job) => job.id)).toEqual([J.noaDishwasher, J.noaWardrobe]);
    expect(await noa.getJobs()).toHaveLength(3);
    const [summary] = await noa.getJobs({ scope: 'active' });
    expect(summary.professional.displayName).toBe('BrightSpark Electric');
    expect(summary.customer.displayName).toBe('Noa L.');
    expect(summary.description).toContain('spotlights');
    const lior = await env.as(PRO_IDS.lior).jobs.getJobs({ scope: 'active' });
    expect(lior.map((job) => job.status)).toEqual(['in_progress']);
  });

  it('creates a review, updates the professional’s stats and notifies them', async () => {
    const before = db().professionals.require(PRO_IDS.moshe, 'Pro').stats;
    const review = await env.as(NOA).jobs.createReview(J.noaDishwasher, { rating: 4, comment: '  Quick and professional.  ' });
    expect(review).toMatchObject({
      jobId: J.noaDishwasher,
      professionalId: PRO_IDS.moshe,
      customerId: NOA,
      rating: 4,
      comment: 'Quick and professional.',
      customerDisplayName: 'Noa L.',
      categoryId: 'appliance_repair',
    });
    const after = db().professionals.require(PRO_IDS.moshe, 'Pro').stats;
    expect(after.reviewCount).toBe(before.reviewCount + 1);
    expect(after).toEqual(computeProfessionalStats(db(), PRO_IDS.moshe));
    expect(lastNotification(PRO_IDS.moshe)).toMatchObject({
      type: 'review_received',
      params: { rating: 4, customerName: 'Noa L.' },
      target: { kind: 'professional', professionalId: PRO_IDS.moshe },
    });

    const details = await env.as(NOA).jobs.getJobById(J.noaDishwasher);
    expect(details).toMatchObject({ canReview: false, reviewId: review.id, review: { id: review.id } });
    const reviews = await env.as(PRO_IDS.moshe).professionals.getProfessionalReviews(PRO_IDS.moshe);
    expect(reviews.items[0].id).toBe(review.id);
    expect(reviews.breakdown.reviewCount).toBe(after.reviewCount);
    expect(reviews.breakdown.averageRating).toBe(after.averageRating);

    const dashboard = await env.as(NOA).dashboard.getCustomerDashboard();
    expect(dashboard.jobsAwaitingReview).toHaveLength(0);
  });

  it('allows only one review per completed job, by its customer', async () => {
    await env.as(NOA).jobs.createReview(J.noaDishwasher, { rating: 5, comment: null });
    expect(await expectApiError(env.as(NOA).jobs.createReview(J.noaDishwasher, { rating: 1, comment: null }))).toMatchObject({
      status: 409,
      code: 'CONFLICT',
    });
    expect(await expectApiError(env.as(NOA).jobs.createReview(J.noaWardrobe, { rating: 5, comment: null }))).toMatchObject({
      status: 409,
    });
    expect(await expectApiError(env.as(NOA).jobs.createReview(J.noaLighting, { rating: 5, comment: null }))).toMatchObject({
      status: 409,
    });
    expect(
      await expectApiError(env.as(DEMO_CUSTOMER_IDS.daniel).jobs.createReview(J.noaDishwasher, { rating: 5, comment: null })),
    ).toMatchObject({ status: 403 });
    expect(await expectApiError(env.as(PRO_IDS.moshe).jobs.createReview(J.noaDishwasher, { rating: 5, comment: null }))).toMatchObject({
      status: 403,
    });
    const invalid = await expectApiError(
      env.as(DEMO_CUSTOMER_IDS.daniel).jobs.createReview(J.danielWifi, { rating: 5, comment: null }),
    );
    expect(invalid.status).toBe(409);
    expect(db().reviews.filter((review) => review.jobId === J.noaDishwasher)).toHaveLength(1);
  });
});
