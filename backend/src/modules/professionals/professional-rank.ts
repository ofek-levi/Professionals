/** Search ranking of professionals (ported from the app's `features/reviews/rating.ts`). */

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
