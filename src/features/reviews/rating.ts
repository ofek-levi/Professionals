/** Rating aggregation shared by the reviews UI, offer ranking and the mock backend's stats. */
import { RATING_VALUES, type Rating, type RatingBreakdown, type Review } from '@/types/domain';

/**
 * Prior used for Bayesian averages: a professional with few reviews is pulled towards the
 * marketplace mean, so one 5★ review does not outrank fifty 4.9★ reviews.
 */
export const RATING_PRIOR = { mean: 4.2, weight: 5 } as const;

/** Rounds to one decimal (the precision shown everywhere). */
export function roundRating(value: number): number {
  return Math.round(value * 10) / 10;
}

export function isRating(value: unknown): value is Rating {
  return typeof value === 'number' && (RATING_VALUES as readonly number[]).includes(value);
}

/** Average (rounded to 0.1) and per-star distribution. `averageRating` is `null` without reviews. */
export function computeRatingBreakdown(reviews: readonly Pick<Review, 'rating'>[]): RatingBreakdown {
  const distribution: Record<Rating, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  for (const review of reviews) {
    distribution[review.rating] += 1;
    sum += review.rating;
  }
  return {
    averageRating: reviews.length > 0 ? roundRating(sum / reviews.length) : null,
    reviewCount: reviews.length,
    distribution,
  };
}

/** Share (0–1) of each star value, handy for rating bars. */
export function ratingDistributionShares(breakdown: RatingBreakdown): Record<Rating, number> {
  const total = breakdown.reviewCount;
  const share = (rating: Rating) => (total > 0 ? breakdown.distribution[rating] / total : 0);
  return { 1: share(1), 2: share(2), 3: share(3), 4: share(4), 5: share(5) };
}

/** Bayesian average rating (not rounded) used for ranking. */
export function bayesianRating(
  averageRating: number | null,
  reviewCount: number,
  prior: { mean: number; weight: number } = RATING_PRIOR,
): number {
  const count = averageRating === null ? 0 : Math.max(0, reviewCount);
  const sum = averageRating === null ? 0 : averageRating * count;
  return (prior.mean * prior.weight + sum) / (prior.weight + count);
}
