import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { clearDatabase, createTestApp } from '../../../../test/app.js';
import { signInCustomer, signInProfessional, type SignedInProfessional } from '../../../../test/auth.js';
import { createJob, createOffer, createRequest } from '../../../../test/factories.js';
import { KEY_SPACES } from '../../../infra/keys.js';
import { JobModel } from '../../jobs/job.model.js';
import { bayesianRating } from '../../professionals/professional-rank.js';
import { ProfessionalModel } from '../../professionals/professional.model.js';
import { notificationTypes } from '../../requests/__tests__/marketplace-fixtures.js';
import { ReviewModel } from '../review.model.js';

describe('POST /v1/jobs/:id/review', () => {
  const { app, deps } = createTestApp();
  let pro: SignedInProfessional;
  beforeEach(async () => {
    await clearDatabase();
    deps.realtime.clear();
    pro = await signInProfessional(deps);
  });

  async function completedJob() {
    const customer = await signInCustomer(deps);
    const req = await createRequest(customer.user, { status: 'completed' });
    const offer = await createOffer(req, pro.professional, { status: 'accepted' });
    const job = await createJob(req, offer, { status: 'completed', completedAt: deps.clock.now() });
    return { customer, jobId: job._id.toHexString() };
  }

  it('aggregates ratings (0.1 precision) and the search rank on the professional', async () => {
    for (const rating of [5, 4, 4]) {
      const { customer, jobId } = await completedJob();
      await request(app).post(`/v1/jobs/${jobId}/review`).set(customer.headers).send({ rating, comment: null }).expect(201);
    }
    const stats = (await ProfessionalModel.findById(pro.user._id).lean())?.stats;
    expect(stats).toMatchObject({ averageRating: 4.3, reviewCount: 3, rankScore: bayesianRating(4.3, 3) });
    expect(notificationTypes(deps, pro.user._id.toHexString())).toEqual(['review_received', 'review_received', 'review_received']);
    const list = await request(app).get(`/v1/professionals/${pro.user._id.toHexString()}/reviews`).set(pro.headers).expect(200);
    expect(list.body.breakdown).toMatchObject({ averageRating: 4.3, reviewCount: 3 });
  });

  it('drops the cached public profile when the rating changes', async () => {
    const { customer, jobId } = await completedJob();
    const url = `/v1/professionals/${pro.user._id.toHexString()}`;
    const before = await request(app).get(url).set(customer.headers).expect(200);
    expect(before.body.stats.reviewCount).toBe(0);
    await request(app).post(`/v1/jobs/${jobId}/review`).set(customer.headers).send({ rating: 5, comment: 'Spotless' }).expect(201);
    expect(await deps.redis.exists(deps.keys.key(KEY_SPACES.cache, `professional:public:${pro.user._id.toHexString()}`))).toBe(0);
    const after = await request(app).get(url).set(customer.headers).expect(200);
    expect(after.body.stats).toMatchObject({ reviewCount: 1, averageRating: 5 });
  });

  it('accepts one review per completed job, by its customer, even under a double submit', async () => {
    const { customer, jobId } = await completedJob();
    await request(app).post(`/v1/jobs/${jobId}/review`).set((await signInCustomer(deps)).headers).send({ rating: 5, comment: null }).expect(403);
    await request(app).post(`/v1/jobs/${jobId}/review`).set(pro.headers).send({ rating: 5, comment: null }).expect(403);
    const invalid = await request(app).post(`/v1/jobs/${jobId}/review`).set(customer.headers).send({ rating: 6, comment: 'x'.repeat(801) }).expect(400);
    expect(invalid.body.fieldErrors).toEqual({ rating: ['validation:review.ratingInvalid'], comment: ['validation:review.commentTooLong'] });
    const missing = await request(app).post(`/v1/jobs/${jobId}/review`).set(customer.headers).send({}).expect(400);
    expect(missing.body.fieldErrors).toEqual({ rating: ['validation:review.ratingRequired'] });

    const responses = await Promise.all([1, 2, 3].map(() => request(app).post(`/v1/jobs/${jobId}/review`).set(customer.headers).send({ rating: 3, comment: null })));
    expect(responses.map((res) => res.status).sort()).toEqual([201, 409, 409]);
    expect(await ReviewModel.countDocuments({ job: jobId })).toBe(1);
    expect((await JobModel.findById(jobId).lean())?.review?.toHexString()).toBe(responses.find((res) => res.status === 201)?.body.id);
    expect((await ProfessionalModel.findById(pro.user._id).lean())?.stats.reviewCount).toBe(1);
  });

  it('refuses jobs that are not completed', async () => {
    const customer = await signInCustomer(deps);
    const req = await createRequest(customer.user, { status: 'scheduled' });
    const job = await createJob(req, await createOffer(req, pro.professional, { status: 'accepted' }));
    const res = await request(app).post(`/v1/jobs/${job._id.toHexString()}/review`).set(customer.headers).send({ rating: 5, comment: null }).expect(409);
    expect(res.body.code).toBe('CONFLICT');
    await request(app).post('/v1/jobs/000000000000000000000000/review').set(customer.headers).send({ rating: 5, comment: null }).expect(404);
  });
});
