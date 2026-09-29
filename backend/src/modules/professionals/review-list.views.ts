/** `Review` DTOs (reviewer name/avatar resolved from `users`, always current) and the breakdown. */
import { required } from '../../lib/batch.js';
import type { RatingBreakdown, Review } from '../../shared/contract/index.js';
import { RATING_VALUES, type Rating } from '../../shared/domain.js';
import type { ReviewDoc } from '../reviews/review.model.js';
import { loadUserDisplays, type UserDisplay } from '../users/user-display.views.js';

export function toReviewDto(review: ReviewDoc, reviewer: Pick<UserDisplay, 'shortName' | 'avatarUrl'>): Review {
  return {
    id: review._id.toHexString(),
    jobId: review.job.toHexString(),
    professionalId: review.professional.toHexString(),
    customerId: review.customer.toHexString(),
    categoryId: review.categoryId,
    rating: review.rating,
    comment: review.comment,
    // Customers appear as "Noa L." to everyone (as in the app).
    customerDisplayName: reviewer.shortName,
    customerAvatarUrl: reviewer.avatarUrl,
    createdAt: review.createdAt.toISOString(),
  };
}

/** A page of reviews with one users/professionals lookup for all reviewers. */
export async function toReviewDtos(reviews: ReviewDoc[]): Promise<Review[]> {
  const reviewers = await loadUserDisplays(reviews.map((review) => review.customer));
  return reviews.map((review) => toReviewDto(review, required(reviewers, review.customer, 'Reviewer')));
}

/** Breakdown from `{ _id: rating, count }` rows; the average is rounded to 0.1 like the app. */
export function toRatingBreakdown(rows: readonly { _id: number; count: number }[]): RatingBreakdown {
  const distribution = Object.fromEntries(RATING_VALUES.map((rating) => [rating, 0])) as Record<Rating, number>;
  let reviewCount = 0;
  let sum = 0;
  for (const row of rows) {
    const rating = RATING_VALUES.find((value) => value === row._id);
    if (rating === undefined) continue;
    distribution[rating] = row.count;
    reviewCount += row.count;
    sum += rating * row.count;
  }
  return { averageRating: reviewCount > 0 ? Math.round((sum / reviewCount) * 10) / 10 : null, reviewCount, distribution };
}

