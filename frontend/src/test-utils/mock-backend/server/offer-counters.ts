/** Aggregates over a request's offers, denormalized onto requests and customer views (the backend keeps these counters itself). */
import type { ISODateTimeString, Offer } from '@/types/domain';

interface RequestOfferStats {
  /** Offers that were not withdrawn (`ServiceRequest.offerCount`). */
  offerCount: number;
  /** Offers awaiting the customer's decision (`ServiceRequest.pendingOfferCount`). */
  pendingOfferCount: number;
  /** Newest pending offer (`CustomerRequestView.latestOfferAt`). */
  latestOfferAt: ISODateTimeString | null;
  /** Lowest pending/accepted price (`CustomerRequestView.lowestOfferPrice`). */
  lowestOfferPrice: number | null;
}

export function computeRequestOfferStats(offers: readonly Pick<Offer, 'status' | 'price' | 'createdAt'>[]): RequestOfferStats {
  let offerCount = 0;
  let pendingOfferCount = 0;
  let latestOfferAt: ISODateTimeString | null = null;
  let lowestOfferPrice: number | null = null;
  for (const offer of offers) {
    if (offer.status !== 'withdrawn') offerCount += 1;
    if (offer.status === 'pending') {
      pendingOfferCount += 1;
      if (latestOfferAt === null || Date.parse(offer.createdAt) > Date.parse(latestOfferAt)) latestOfferAt = offer.createdAt;
    }
    if (offer.status === 'pending' || offer.status === 'accepted') {
      lowestOfferPrice = lowestOfferPrice === null ? offer.price : Math.min(lowestOfferPrice, offer.price);
    }
  }
  return { offerCount, pendingOfferCount, latestOfferAt, lowestOfferPrice };
}
