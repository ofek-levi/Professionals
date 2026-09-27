/**
 * Ranking of offers on the customer's comparison screen and the "best value" highlights.
 * The mock backend sorts `GET /requests/:id/offers` with the same functions.
 */
import type { OfferSort } from '@/types/api';
import type { EntityId, OfferStatus, OfferWithProfessional } from '@/types/domain';
import { bayesianRating } from '@/features/reviews/rating';

/** Weights of the "recommended" score (sum = 1). */
export const RECOMMENDED_SCORE_WEIGHTS = {
  price: 0.35,
  earliestStart: 0.2,
  rating: 0.3,
  reviewCount: 0.15,
} as const;

/** Review count at which the "experience" component of the score saturates. */
const REVIEW_COUNT_SATURATION = 60;

type RankableOffer = Pick<OfferWithProfessional, 'id' | 'status' | 'price' | 'proposedStartAt' | 'createdAt'> & {
  professional: Pick<OfferWithProfessional['professional'], 'averageRating' | 'reviewCount'>;
};

/** Accepted first, then pending, then everything else (rejected/withdrawn/expired). */
function statusRank(status: OfferStatus): number {
  if (status === 'accepted') return 0;
  if (status === 'pending') return 1;
  return 2;
}

const startTime = (offer: RankableOffer) => Date.parse(offer.proposedStartAt);

/** Min-max normalization where `1` is the best value; a single value (or all equal) scores 1. */
function normalizer(values: number[], higherIsBetter: boolean): (value: number) => number {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (!Number.isFinite(min) || max === min) return () => 1;
  return (value) => (higherIsBetter ? (value - min) / (max - min) : (max - value) / (max - min));
}

/**
 * Recommended score in [0, 1] for each offer: cheaper, earlier, better rated (Bayesian average with
 * a prior) and more reviewed professionals score higher. Price and start time are normalized
 * relative to the other offers; rating and review count on absolute scales.
 */
export function computeRecommendationScores<T extends RankableOffer>(offers: readonly T[]): Map<EntityId, number> {
  const scores = new Map<EntityId, number>();
  if (offers.length === 0) return scores;
  const priceScore = normalizer(offers.map((offer) => offer.price), false);
  const startScore = normalizer(offers.map(startTime), false);
  for (const offer of offers) {
    const rating = bayesianRating(offer.professional.averageRating, offer.professional.reviewCount);
    const ratingScore = Math.min(1, Math.max(0, (rating - 3) / 2));
    const experienceScore = Math.min(1, Math.log1p(offer.professional.reviewCount) / Math.log1p(REVIEW_COUNT_SATURATION));
    scores.set(
      offer.id,
      RECOMMENDED_SCORE_WEIGHTS.price * priceScore(offer.price) +
        RECOMMENDED_SCORE_WEIGHTS.earliestStart * startScore(startTime(offer)) +
        RECOMMENDED_SCORE_WEIGHTS.rating * ratingScore +
        RECOMMENDED_SCORE_WEIGHTS.reviewCount * experienceScore,
    );
  }
  return scores;
}

/**
 * Sorts offers for display. Regardless of `sort`, the accepted offer comes first and non-pending
 * offers come after pending ones. Ties are broken by submission time, then id.
 */
export function sortOffers<T extends RankableOffer>(offers: readonly T[], sort: OfferSort = 'recommended'): T[] {
  // Scores are normalized within each status group, since groups are never compared by score.
  const scores = new Map<EntityId, number>();
  for (const rank of [0, 1, 2]) {
    const group = offers.filter((offer) => statusRank(offer.status) === rank);
    computeRecommendationScores(group).forEach((value, id) => scores.set(id, value));
  }
  const score = (offer: T) => scores.get(offer.id) ?? 0;
  const tieBreak = (a: T, b: T) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id);
  const byRating = (a: T, b: T) =>
    (b.professional.averageRating ?? -1) - (a.professional.averageRating ?? -1) ||
    b.professional.reviewCount - a.professional.reviewCount;

  const comparators: Record<OfferSort, (a: T, b: T) => number> = {
    recommended: (a, b) => score(b) - score(a),
    lowest_price: (a, b) => a.price - b.price,
    earliest_availability: (a, b) => startTime(a) - startTime(b),
    highest_rating: byRating,
    most_reviews: (a, b) => b.professional.reviewCount - a.professional.reviewCount || byRating(a, b),
  };
  const compare = comparators[sort];
  return [...offers].sort((a, b) => statusRank(a.status) - statusRank(b.status) || compare(a, b) || tieBreak(a, b));
}

export interface OfferHighlights {
  lowestPriceOfferId: EntityId | null;
  earliestOfferId: EntityId | null;
  topRatedOfferId: EntityId | null;
}

/** Id of the single strictly-best item, or null when there is a tie for first place. */
function uniqueBest<T>(items: readonly T[], value: (item: T) => number, id: (item: T) => EntityId): EntityId | null {
  let best: T | null = null;
  let tie = false;
  for (const item of items) {
    if (best === null || value(item) > value(best)) {
      best = item;
      tie = false;
    } else if (value(item) === value(best)) {
      tie = true;
    }
  }
  return best !== null && !tie ? id(best) : null;
}

/**
 * Badges for the comparison screen, computed over pending offers only. Highlights need at least
 * two pending offers to compare and are omitted when several offers tie for first place.
 */
export function getOfferHighlights<T extends RankableOffer>(offers: readonly T[]): OfferHighlights {
  const pending = offers.filter((offer) => offer.status === 'pending');
  if (pending.length < 2) return { lowestPriceOfferId: null, earliestOfferId: null, topRatedOfferId: null };
  const reviewed = pending.filter((offer) => offer.professional.averageRating !== null && offer.professional.reviewCount > 0);
  const getId = (offer: T) => offer.id;
  return {
    lowestPriceOfferId: uniqueBest(pending, (offer) => -offer.price, getId),
    earliestOfferId: uniqueBest(pending, (offer) => -startTime(offer), getId),
    topRatedOfferId: uniqueBest(
      reviewed,
      (offer) => Math.round(bayesianRating(offer.professional.averageRating, offer.professional.reviewCount) * 1000),
      getId,
    ),
  };
}
