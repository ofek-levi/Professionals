/** Thin review controller: validate → service → view. */
import type { Request } from 'express';

import type { AppDeps } from '../../deps.js';
import { parseObjectId } from '../../lib/ids.js';
import { validateRequest } from '../../lib/validate.js';
import { authOf } from '../../middleware/auth.js';
import type { Review } from '../../shared/contract/index.js';
import { toReviewDtos } from '../professionals/review-list.views.js';
import { createReview } from './review.service.js';
import { createReviewBody, reviewJobParams } from './reviews.schemas.js';

/** `POST /v1/jobs/:jobId/review` → 201 `Review` */
export const create = (deps: AppDeps) => async (req: Request): Promise<Review> => {
  const { params, body } = validateRequest(req, { params: reviewJobParams, body: createReviewBody });
  const review = await createReview(deps, authOf(req, 'customer'), parseObjectId(params.jobId, 'Job'), body);
  const [dto] = await toReviewDtos([review]);
  if (!dto) throw new Error(`Review ${review._id.toHexString()} has no view`);
  return dto;
};
