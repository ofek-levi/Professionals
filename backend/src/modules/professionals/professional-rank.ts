/**
 * Rating aggregates of a professional: the breakdown derived from the stored per-star counts
 * (`stats.ratingCounts`) and the search rank (ported from the app's `features/reviews/rating.ts`).
 */
import type { RatingBreakdown } from '../../shared/contract/index.js';
import { RATING_VALUES, type Rating } from '../../shared/domain.js';

/**
 * Prior of the Bayesian average: a professional with few reviews is pulled towards the marketplace
 * mean, so one 5★ review does not outrank fifty 4.9★ reviews.
 */
export const RATING_PRIOR = { mean: 4.2, weight: 5 } as const;

/** Value stored as `stats.rankScore` (not rounded). */
export function bayesianRating(averageRating: number | null, reviewCount: number): number {
  const count = averageRating === null ? 0 : Math.max(0, reviewCount);
  const sum = averageRating === null ? 0 : averageRating * count;
  return (RATING_PRIOR.mean * RATING_PRIOR.weight + sum) / (RATING_PRIOR.weight + count);
}

/** Five zeros: `ratingCounts[rating - 1]` is the number of reviews with that rating. */
export function emptyRatingCounts(): number[] {
  return RATING_VALUES.map(() => 0);
}

/** Breakdown from per-star counts; the average is rounded to 0.1 like the app. */
export function ratingBreakdown(ratingCounts: readonly number[] | undefined): RatingBreakdown {
  const distribution = {} as Record<Rating, number>;
  let reviewCount = 0;
  let sum = 0;
  for (const rating of RATING_VALUES) {
    const count = ratingCounts?.[rating - 1] ?? 0;
    distribution[rating] = count;
    reviewCount += count;
    sum += rating * count;
  }
  return { averageRating: reviewCount > 0 ? Math.round((sum / reviewCount) * 10) / 10 : null, reviewCount, distribution };
}
