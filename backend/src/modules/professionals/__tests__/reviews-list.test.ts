import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { clearDatabase, createTestApp } from '../../../../test/app.js';
import { signInProfessional } from '../../../../test/auth.js';
import { createCustomer, createProfessional } from '../../../../test/factories.js';
import { newObjectId } from '../../../lib/ids.js';
import type { Rating } from '../../../shared/domain.js';
import { recordReviewRating } from '../../reviews/professional-stats.service.js';
import { ReviewModel } from '../../reviews/review.model.js';
import type { UserDoc } from '../../users/user.model.js';

describe('GET /v1/professionals/:id/reviews', () => {
  const { app, deps } = createTestApp();
  beforeEach(clearDatabase);

  async function review(professionalId: UserDoc['_id'], customer: UserDoc, rating: Rating, comment: string | null = null) {
    deps.clock.advanceMinutes(1);
    const doc = await ReviewModel.create({ job: newObjectId(), professional: professionalId, customer: customer._id, categoryId: 'plumbing', rating, comment });
    await recordReviewRating(deps, professionalId, rating); // what `createReview` does in its transaction
    return doc.toObject();
  }

  it('lists reviews newest first with the reviewer as others see them and the full breakdown', async () => {
    const viewer = await signInProfessional(deps);
    const { professional } = await createProfessional();
    const noa = await createCustomer({ firstName: 'Noa', lastName: 'Levi', avatar: { url: 'https://img.test/noa.jpg', publicId: 'noa' } });
    const dan = await createCustomer({ firstName: 'Dan', lastName: 'Katz' });
    const first = await review(professional._id, noa, 5, 'Great work');
    await review(professional._id, dan, 4);
    const last = await review(professional._id, dan, 3, 'Late but fine');
    await review((await createProfessional()).professional._id, noa, 1);

    const res = await request(app).get(`/v1/professionals/${professional._id.toHexString()}/reviews`).set(viewer.headers).query({ limit: 2 }).expect(200);
    expect(res.body.totalCount).toBe(3);
    expect(res.body.breakdown).toEqual({ averageRating: 4, reviewCount: 3, distribution: { 1: 0, 2: 0, 3: 1, 4: 1, 5: 1 } });
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0]).toEqual({
      id: last._id.toHexString(),
      jobId: last.job.toHexString(),
      professionalId: professional._id.toHexString(),
      customerId: dan._id.toHexString(),
      categoryId: 'plumbing',
      rating: 3,
      comment: 'Late but fine',
      customerDisplayName: 'Dan K.',
      customerAvatarUrl: null,
      createdAt: last.createdAt.toISOString(),
    });

    const next = await request(app)
      .get(`/v1/professionals/${professional._id.toHexString()}/reviews`)
      .set(viewer.headers)
      .query({ limit: 2, cursor: res.body.nextCursor })
      .expect(200);
    expect(next.body.nextCursor).toBeNull();
    expect(next.body.items).toEqual([expect.objectContaining({ id: first._id.toHexString(), customerDisplayName: 'Noa L.', customerAvatarUrl: 'https://img.test/noa.jpg' })]);
    expect(next.body.breakdown).toEqual(res.body.breakdown);
  });

  it('answers an empty page for a professional without reviews', async () => {
    const viewer = await signInProfessional(deps);
    const res = await request(app).get(`/v1/professionals/${viewer.user._id.toHexString()}/reviews`).set(viewer.headers).expect(200);
    expect(res.body).toEqual({
      items: [],
      nextCursor: null,
      totalCount: 0,
      breakdown: { averageRating: null, reviewCount: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } },
    });
  });

  it('answers 404 for unknown professionals and 400 for bad paging', async () => {
    const viewer = await signInProfessional(deps);
    await request(app).get(`/v1/professionals/${newObjectId().toHexString()}/reviews`).set(viewer.headers).expect(404);
    const res = await request(app).get(`/v1/professionals/${viewer.user._id.toHexString()}/reviews`).set(viewer.headers).query({ limit: 101, cursor: 'x' }).expect(400);
    expect(res.body.fieldErrors).toEqual({ limit: ['validation:invalid'] });
    await request(app).get(`/v1/professionals/${viewer.user._id.toHexString()}/reviews`).expect(401);
  });
});
