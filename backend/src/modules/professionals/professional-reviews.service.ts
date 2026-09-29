/** `GET /professionals/:id/reviews`: newest first (keyset) plus the rating breakdown of all reviews. */
import type { Types } from 'mongoose';

import { ApiError } from '../../lib/errors.js';
import { afterCursorFilter, decodeCursor, sortOf, toPage, type PageParams, type SortSpec } from '../../lib/pagination.js';
import type { Paginated, RatingBreakdown, Review } from '../../shared/contract/index.js';
import { ReviewModel, type ReviewDoc } from '../reviews/review.model.js';
import { ProfessionalModel } from './professional.model.js';
import { toRatingBreakdown, toReviewDtos } from './review-list.views.js';

const NEWEST_FIRST: SortSpec = [
  { path: 'createdAt', direction: -1 },
  { path: '_id', direction: -1 },
];

export type ProfessionalReviewsPage = Paginated<Review> & { breakdown: RatingBreakdown };

/**
 * Three queries in parallel, all on the `{professional, createdAt, _id}` index: existence, the
 * page, and a `$group` by rating whose total doubles as `totalCount`.
 */
export async function listProfessionalReviews(professionalId: Types.ObjectId, page: PageParams): Promise<ProfessionalReviewsPage> {
  const filter = { professional: professionalId };
  const after = page.cursor ? afterCursorFilter(NEWEST_FIRST, decodeCursor(page.cursor, NEWEST_FIRST)) : null;
  const [exists, docs, rows] = await Promise.all([
    ProfessionalModel.exists({ _id: professionalId }),
    ReviewModel.find(after ? { $and: [filter, after] } : filter)
      .sort(sortOf(NEWEST_FIRST))
      .limit(page.limit + 1)
      .lean<ReviewDoc[]>(),
    ReviewModel.aggregate<{ _id: number; count: number }>([{ $match: filter }, { $group: { _id: '$rating', count: { $sum: 1 } } }]),
  ]);
  if (!exists) throw ApiError.notFound('Professional');
  const breakdown = toRatingBreakdown(rows);
  const result = toPage(docs, page, NEWEST_FIRST, breakdown.reviewCount);
  return { ...result, items: await toReviewDtos(result.items), breakdown };
}
