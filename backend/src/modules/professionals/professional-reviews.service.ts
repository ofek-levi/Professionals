/** `GET /professionals/:id/reviews`: newest first (keyset) plus the rating breakdown of all reviews. */
import type { Types } from 'mongoose';

import { ApiError } from '../../lib/errors.js';
import { findPage, NEWEST_FIRST, type PageParams } from '../../lib/pagination.js';
import type { Paginated, RatingBreakdown, Review } from '../../shared/contract/index.js';
import { ReviewModel, type ReviewDoc } from '../reviews/review.model.js';
import { ratingBreakdown } from './professional-rank.js';
import { ProfessionalModel, type ProfessionalDoc } from './professional.model.js';
import { toReviewDtos } from './review-list.views.js';

export type ProfessionalReviewsPage = Paginated<Review> & { breakdown: RatingBreakdown };

/**
 * The page (`{professional, createdAt, _id}` index) and, in parallel, the professional's stored
 * per-star counts: they give the breakdown and `totalCount` on every page without reading reviews.
 */
export async function listProfessionalReviews(professionalId: Types.ObjectId, page: PageParams): Promise<ProfessionalReviewsPage> {
  const breakdown = ProfessionalModel.findById(professionalId, { 'stats.ratingCounts': 1 })
    .lean<{ stats: Pick<ProfessionalDoc['stats'], 'ratingCounts'> }>()
    .then((professional) => {
      if (!professional) throw ApiError.notFound('Professional');
      return ratingBreakdown(professional.stats.ratingCounts);
    });
  const [result, known] = await Promise.all([
    findPage<ReviewDoc>(ReviewModel, {
      filter: { professional: professionalId },
      sort: NEWEST_FIRST,
      page,
      totalCount: breakdown.then((value) => value.reviewCount),
    }),
    breakdown,
  ]);
  return { ...result, items: await toReviewDtos(result.items), breakdown: known };
}
