/**
 * Offer comparison helpers for the customer's request screen: the list filter and the "best value"
 * markers of the side-by-side comparison table.
 */
import type { OfferStatus, OfferWithProfessional } from '@/types/domain';

export const OFFER_LIST_FILTERS = ['pending', 'all'] as const;
export type OfferListFilter = (typeof OFFER_LIST_FILTERS)[number];

/** `statuses` param of `GET /requests/:id/offers`. Once the request stops accepting offers, everything is shown. */
export function offerStatusesForFilter(filter: OfferListFilter, requestAcceptsOffers: boolean): OfferStatus[] | undefined {
  return filter === 'pending' && requestAcceptsOffers ? ['pending'] : undefined;
}

export const COMPARE_METRICS = [
  'price',
  'start',
  'duration',
  'rating',
  'reviews',
  'experience',
  'completedJobs',
  'distance',
] as const;
export type CompareMetric = (typeof COMPARE_METRICS)[number];

type ComparableOffer = Pick<OfferWithProfessional, 'id' | 'price' | 'proposedStartAt' | 'estimatedDurationMinutes' | 'distanceKm'> & {
  professional: Pick<OfferWithProfessional['professional'], 'averageRating' | 'reviewCount' | 'yearsOfExperience' | 'completedJobsCount'>;
};

/** Numeric value of a metric (`null` = unknown) and whether higher is better. */
const METRICS: Record<CompareMetric, { value: (offer: ComparableOffer) => number | null; higherIsBetter: boolean }> = {
  price: { value: (offer) => offer.price, higherIsBetter: false },
  start: { value: (offer) => Date.parse(offer.proposedStartAt), higherIsBetter: false },
  duration: { value: (offer) => offer.estimatedDurationMinutes, higherIsBetter: false },
  rating: { value: (offer) => (offer.professional.reviewCount > 0 ? offer.professional.averageRating : null), higherIsBetter: true },
  reviews: { value: (offer) => offer.professional.reviewCount, higherIsBetter: true },
  experience: { value: (offer) => offer.professional.yearsOfExperience, higherIsBetter: true },
  completedJobs: { value: (offer) => offer.professional.completedJobsCount, higherIsBetter: true },
  distance: { value: (offer) => offer.distanceKm, higherIsBetter: false },
};

/**
 * Ids of the offers holding the best value of each metric. Ties are all marked; nothing is marked
 * with fewer than two comparable values or when every value is equal.
 */
export function getCompareBestIds(offers: readonly ComparableOffer[]): Record<CompareMetric, ReadonlySet<string>> {
  const result = {} as Record<CompareMetric, ReadonlySet<string>>;
  for (const metric of COMPARE_METRICS) {
    const { value, higherIsBetter } = METRICS[metric];
    const known = offers
      .map((offer) => ({ id: offer.id, value: value(offer) }))
      .filter((entry): entry is { id: string; value: number } => entry.value !== null && Number.isFinite(entry.value));
    const values = known.map((entry) => entry.value);
    const best = higherIsBetter ? Math.max(...values) : Math.min(...values);
    const allEqual = values.every((entry) => entry === values[0]);
    result[metric] = new Set(known.length >= 2 && !allEqual ? known.filter((entry) => entry.value === best).map((entry) => entry.id) : []);
  }
  return result;
}
