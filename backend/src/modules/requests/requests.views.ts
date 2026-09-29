/**
 * Request DTOs (the mock backend's `views.ts`). Owners get the full request plus offer stats;
 * professionals get the privacy view until their offer is accepted: approximate location (same pin
 * for everyone, seeded by the request id), no access notes and no job link.
 */
import type { Types } from 'mongoose';

import { toServiceLocation } from '../../infra/schema-parts.js';
import { required } from '../../lib/batch.js';
import { approximateLocation } from '../../lib/geo.js';
import type {
  CustomerRequestView,
  MyOfferSummary,
  ProfessionalRequestView,
  ServiceRequest,
} from '../../shared/contract/index.js';
import { ACTIVE_OFFER_STATUSES, type OfferStatus } from '../../shared/statuses.js';
import { loadCustomerSummaries } from '../customers/customer-summary.views.js';
import { loadRequestOfferStats } from '../offers/offer-counters.service.js';
import { OfferModel, type OfferDoc } from '../offers/offer.model.js';
import { distanceKm, isRequestMatch, type MatchableProfessional } from './matching.service.js';
import type { RequestDoc } from './request.model.js';

const iso = (date: Date | null) => (date ? date.toISOString() : null);
const hex = (id: Types.ObjectId | null) => (id ? id.toHexString() : null);

/** The request as its owner (and the parties of its job) see it. */
export function toServiceRequestDto(request: RequestDoc): ServiceRequest {
  return {
    id: request._id.toHexString(),
    customerId: request.customer.toHexString(),
    categoryId: request.categoryId,
    description: request.description,
    location: toServiceLocation(request.location),
    urgency: request.urgency,
    preferredSchedule: request.preferredSchedule ? { date: request.preferredSchedule.date, timeWindow: request.preferredSchedule.timeWindow } : null,
    photos: request.photos.map((photo) => ({ id: photo.upload.toHexString(), url: photo.url, width: photo.width, height: photo.height })),
    notes: request.notes,
    status: request.status,
    offerCount: request.offerCount,
    pendingOfferCount: request.pendingOfferCount,
    acceptedOfferId: hex(request.acceptedOffer),
    jobId: hex(request.job),
    publishedAt: iso(request.publishedAt),
    cancelledAt: iso(request.cancelledAt),
    cancellationReason: request.cancellationReason,
    cancellationComment: request.cancellationComment,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
  };
}

/** Owner views of a page of requests (one offers aggregation for all of them). */
export async function toCustomerRequestViews(requests: RequestDoc[]): Promise<CustomerRequestView[]> {
  const stats = await loadRequestOfferStats(requests.map((request) => request._id));
  return requests.map((request) => {
    const own = stats.get(request._id.toHexString());
    return { ...toServiceRequestDto(request), latestOfferAt: iso(own?.latestOfferAt ?? null), lowestOfferPrice: own?.lowestOfferPrice ?? null };
  });
}

type OwnOffer = Pick<OfferDoc, '_id' | 'request' | 'status' | 'price' | 'currency' | 'proposedStartAt' | 'createdAt'>;

const isActive = (status: OfferStatus) => (ACTIVE_OFFER_STATUSES as readonly OfferStatus[]).includes(status);

/** The professional's most relevant offer per request: the active one, otherwise the newest. */
async function loadRelevantOffers(requestIds: Types.ObjectId[], professionalId: Types.ObjectId): Promise<Map<string, OwnOffer>> {
  if (requestIds.length === 0) return new Map();
  const offers = await OfferModel.find(
    { request: { $in: requestIds }, professional: professionalId },
    { request: 1, status: 1, price: 1, currency: 1, proposedStartAt: 1, createdAt: 1 },
  )
    .sort({ request: 1, createdAt: 1 })
    .lean<OwnOffer[]>();
  const relevant = new Map<string, OwnOffer>();
  for (const offer of offers) {
    const key = offer.request.toHexString();
    const current = relevant.get(key);
    if (!current || !isActive(current.status)) relevant.set(key, offer);
  }
  return relevant;
}

function toMyOfferSummary(offer: OwnOffer | undefined): MyOfferSummary | null {
  if (!offer) return null;
  return {
    offerId: offer._id.toHexString(),
    status: offer.status,
    price: offer.price,
    currency: offer.currency,
    proposedStartAt: offer.proposedStartAt.toISOString(),
  };
}

/**
 * Professional views of a page of requests: customer summaries and the professional's own offers
 * are batch-loaded. "Hired" (full address, notes, job id) = the request's accepted offer is theirs.
 */
export async function toProfessionalRequestViews(requests: RequestDoc[], professional: MatchableProfessional): Promise<ProfessionalRequestView[]> {
  const ids = requests.map((request) => request._id);
  const [customers, offers] = await Promise.all([
    loadCustomerSummaries(requests.map((request) => request.customer)),
    loadRelevantOffers(ids, professional._id),
  ]);
  return requests.map((request) => {
    const myOffer = offers.get(request._id.toHexString());
    const hired = request.acceptedOffer !== null && myOffer !== undefined && myOffer._id.equals(request.acceptedOffer);
    const dto = toServiceRequestDto(request);
    return {
      ...dto,
      location: hired ? dto.location : approximateLocation(dto.location, dto.id),
      notes: hired ? dto.notes : null,
      jobId: hired ? dto.jobId : null,
      distanceKm: distanceKm(professional, request),
      customer: required(customers, request.customer, 'Customer'),
      myOffer: toMyOfferSummary(myOffer),
      isMatch: isRequestMatch(request, professional),
    };
  });
}
