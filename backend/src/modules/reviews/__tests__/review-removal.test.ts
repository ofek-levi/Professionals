import { Types } from 'mongoose';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { clearDatabase, createTestApp } from '../../../../test/app.js';
import { signInCustomer, signInProfessional, type SignedInProfessional } from '../../../../test/auth.js';
import { createJob, createOffer, createRequest } from '../../../../test/factories.js';
import { KEY_SPACES } from '../../../infra/keys.js';
import { JobModel } from '../../jobs/job.model.js';
import { bayesianRating, emptyRatingCounts } from '../../professionals/professional-rank.js';
import { ProfessionalModel } from '../../professionals/professional.model.js';
import { removeReview } from '../review-removal.service.js';
import { ReviewModel } from '../review.model.js';

describe('removing a review (operator)', () => {
  const { app, deps } = createTestApp();
  let pro: SignedInProfessional;
  beforeEach(async () => {
    await clearDatabase();
    deps.realtime.clear();
    pro = await signInProfessional(deps);
  });

  /** A completed job of `pro`, reviewed through the API. */
  async function reviewed(rating: number) {
    const customer = await signInCustomer(deps);
    const done = await createRequest(customer.user, { status: 'completed' });
    const job = await createJob(done, await createOffer(done, pro.professional, { status: 'accepted' }), { status: 'completed', completedAt: deps.clock.now() });
    const res = await request(app).post(`/v1/jobs/${job._id.toHexString()}/review`).set(customer.headers).send({ rating, comment: 'Call me' }).expect(201);
    return { customer, jobId: job._id, reviewId: new Types.ObjectId(res.body.id as string) };
  }

  it('deletes the review, frees its job for a new review and recounts the rating from the others', async () => {
    const [kept, removed] = [await reviewed(5), await reviewed(1)];
    await reviewed(4);
    expect((await ProfessionalModel.findById(pro.user._id).lean())?.stats).toMatchObject({ ratingCounts: [1, 0, 0, 1, 1], reviewCount: 3 });
    // Cached now: the removal must drop it.
    const url = `/v1/professionals/${pro.user._id.toHexString()}`;
    await request(app).get(url).set(kept.customer.headers).expect(200);
    deps.realtime.clear();

    expect(await removeReview(deps, removed.reviewId)).toMatchObject({ _id: removed.reviewId, rating: 1, professional: pro.user._id });

    expect(await ReviewModel.exists({ _id: removed.reviewId })).toBeNull();
    expect((await JobModel.findById(removed.jobId).lean())?.review).toBeNull();
    expect((await ProfessionalModel.findById(pro.user._id).lean())?.stats).toMatchObject({
      ratingCounts: [0, 0, 0, 1, 1],
      averageRating: 4.5,
      reviewCount: 2,
      rankScore: bayesianRating(4.5, 2),
    });
    expect(await deps.redis.exists(deps.keys.key(KEY_SPACES.cache, `professional:public:${pro.user._id.toHexString()}`))).toBe(0);
    expect((await request(app).get(url).set(kept.customer.headers).expect(200)).body.stats).toMatchObject({ reviewCount: 2, averageRating: 4.5 });
    const list = await request(app).get(`${url}/reviews`).set(kept.customer.headers).expect(200);
    expect(list.body.items.map((item: { rating: number }) => item.rating)).toEqual([4, 5]);
    expect(list.body.breakdown).toMatchObject({ averageRating: 4.5, reviewCount: 2, distribution: { 1: 0, 4: 1, 5: 1 } });
    // Both parties' apps refetch the job; its customer may review it again.
    expect(deps.realtime.eventsFor(removed.customer.user._id.toHexString()).map((event) => event.type)).toContain('job.updated');
    expect(deps.realtime.eventsFor(pro.user._id.toHexString()).map((event) => event.type)).toEqual(expect.arrayContaining(['job.updated', 'profile.updated']));
    const job = await request(app).get(`/v1/jobs/${removed.jobId.toHexString()}`).set(removed.customer.headers).expect(200);
    expect(job.body).toMatchObject({ review: null, reviewId: null, canReview: true });
  });

  it('brings the rating back to none when the last review goes, and answers null for an unknown review', async () => {
    const only = await reviewed(3);
    await removeReview(deps, only.reviewId);
    expect((await ProfessionalModel.findById(pro.user._id).lean())?.stats).toMatchObject({
      ratingCounts: emptyRatingCounts(),
      averageRating: null,
      reviewCount: 0,
      rankScore: bayesianRating(null, 0),
    });
    expect(await removeReview(deps, only.reviewId)).toBeNull();
    expect(await removeReview(deps, new Types.ObjectId())).toBeNull();
  });
});
