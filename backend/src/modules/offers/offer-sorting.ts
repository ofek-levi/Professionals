/**
 * Ranking of the offers on a request (the app's `features/offers/offer-sorting.ts`, the customer's
 * sort control). The accepted offer comes first and non-pending offers after pending ones,
 * whatever the sort; ties fall back to submission time, then id.
 */
import type { OfferWithProfessional } from '../../shared/contract/index.js';
import type { OfferSort } from '../../shared/domain.js';
import type { OfferStatus } from '../../shared/statuses.js';
import { bayesianRating } from '../professionals/professional-rank.js';

/** Weights of the "recommended" score (sum = 1). */
const WEIGHTS = { price: 0.35, earliestStart: 0.2, rating: 0.3, reviewCount: 0.15 } as const;
/** Review count at which the "experience" component saturates. */
const REVIEW_COUNT_SATURATION = 60;

function statusRank(status: OfferStatus): number {
  if (status === 'accepted') return 0;
  if (status === 'pending') return 1;
  return 2;
}

const startTime = (offer: OfferWithProfessional) => Date.parse(offer.proposedStartAt);

/** Min-max normalization where 1 is the best value; a single value (or all equal) scores 1. */
function normalizer(values: number[], higherIsBetter: boolean): (value: number) => number {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (!Number.isFinite(min) || max === min) return () => 1;
  return (value) => (higherIsBetter ? (value - min) / (max - min) : (max - value) / (max - min));
}

/** Recommended score in [0, 1]: cheaper, earlier, better rated and more reviewed scores higher. */
function recommendationScores(offers: readonly OfferWithProfessional[], scores: Map<string, number>): void {
  if (offers.length === 0) return;
  const priceScore = normalizer(offers.map((offer) => offer.price), false);
  const startScore = normalizer(offers.map(startTime), false);
  for (const offer of offers) {
    const rating = bayesianRating(offer.professional.averageRating, offer.professional.reviewCount);
    const ratingScore = Math.min(1, Math.max(0, (rating - 3) / 2));
    const experienceScore = Math.min(1, Math.log1p(offer.professional.reviewCount) / Math.log1p(REVIEW_COUNT_SATURATION));
    scores.set(
      offer.id,
      WEIGHTS.price * priceScore(offer.price) +
        WEIGHTS.earliestStart * startScore(startTime(offer)) +
        WEIGHTS.rating * ratingScore +
        WEIGHTS.reviewCount * experienceScore,
    );
  }
}

const compareIds = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function sortOffers(offers: readonly OfferWithProfessional[], sort: OfferSort = 'recommended'): OfferWithProfessional[] {
  // Scores are normalized within each status group (groups are never compared by score).
  const scores = new Map<string, number>();
  for (const rank of [0, 1, 2]) recommendationScores(offers.filter((offer) => statusRank(offer.status) === rank), scores);
  const score = (offer: OfferWithProfessional) => scores.get(offer.id) ?? 0;
  const tieBreak = (a: OfferWithProfessional, b: OfferWithProfessional) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || compareIds(a.id, b.id);
  const byRating = (a: OfferWithProfessional, b: OfferWithProfessional) =>
    (b.professional.averageRating ?? -1) - (a.professional.averageRating ?? -1) || b.professional.reviewCount - a.professional.reviewCount;
  const comparators: Record<OfferSort, (a: OfferWithProfessional, b: OfferWithProfessional) => number> = {
    recommended: (a, b) => score(b) - score(a),
    lowest_price: (a, b) => a.price - b.price,
    earliest_availability: (a, b) => startTime(a) - startTime(b),
    highest_rating: byRating,
    most_reviews: (a, b) => b.professional.reviewCount - a.professional.reviewCount || byRating(a, b),
  };
  const compare = comparators[sort];
  return [...offers].sort((a, b) => statusRank(a.status) - statusRank(b.status) || compare(a, b) || tieBreak(a, b));
}
