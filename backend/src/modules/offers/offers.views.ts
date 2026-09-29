/**
 * Offer DTOs (the mock's `views.ts`, offers part). The request embedded in offer views keeps the
 * privacy rule: its exact location only reaches the owner and the hired professional.
 */
import type { Types } from 'mongoose';

import { toServiceLocation } from '../../infra/schema-parts.js';
import { loadByIds, required } from '../../lib/batch.js';
import { approximateLocation } from '../../lib/geo.js';
import type { AuthContext } from '../../middleware/auth.js';
import type {
  Offer,
  OfferDetails,
  OfferRequestSummary,
  OfferWithProfessional,
  OfferWithRequest,
  ProfessionalSummary,
} from '../../shared/contract/index.js';
import { ProfessionalModel, type ProfessionalDoc } from '../professionals/professional.model.js';
import { PROFESSIONAL_SUMMARY_PROJECTION, toProfessionalSummary } from '../professionals/professional.views.js';
import { distanceKm } from '../requests/matching.service.js';
import { RequestModel, type RequestDoc } from '../requests/request.model.js';
import { UserModel, type UserDoc } from '../users/user.model.js';
import { OfferModel, type OfferDoc } from './offer.model.js';

export function toOfferDto(offer: OfferDoc): Offer {
  return {
    id: offer._id.toHexString(),
    requestId: offer.request.toHexString(),
    professionalId: offer.professional.toHexString(),
    price: offer.price,
    currency: offer.currency,
    proposedStartAt: offer.proposedStartAt.toISOString(),
    estimatedDurationMinutes: offer.estimatedDurationMinutes,
    message: offer.message,
    status: offer.status,
    statusReason: offer.statusReason,
    expiresAt: offer.expiresAt.toISOString(),
    createdAt: offer.createdAt.toISOString(),
    updatedAt: offer.updatedAt.toISOString(),
    respondedAt: offer.respondedAt ? offer.respondedAt.toISOString() : null,
  };
}

type OfferingProfessional = Parameters<typeof toProfessionalSummary>[0] & Pick<ProfessionalDoc, 'serviceArea'>;

/** Summaries plus service-area centers (distance to the request) in two queries. */
async function loadOfferingProfessionals(ids: Types.ObjectId[]): Promise<Map<string, { summary: ProfessionalSummary; pro: OfferingProfessional }>> {
  const [professionals, users] = await Promise.all([
    loadByIds<ProfessionalDoc, OfferingProfessional>(ProfessionalModel, ids, { ...PROFESSIONAL_SUMMARY_PROJECTION, 'serviceArea.center': 1 }),
    loadByIds<UserDoc, Pick<UserDoc, '_id' | 'avatar'>>(UserModel, ids, { avatar: 1 }),
  ]);
  return new Map([...professionals].map(([id, pro]) => [id, { pro, summary: toProfessionalSummary(pro, users.get(id)) }]));
}

/** Offers on one request with their professionals (the customer's comparison list). */
export async function toOffersWithProfessional(offers: OfferDoc[], request: Pick<RequestDoc, 'location'>): Promise<OfferWithProfessional[]> {
  const professionals = await loadOfferingProfessionals(offers.map((offer) => offer.professional));
  return offers.map((offer) => {
    const { pro, summary } = required(professionals, offer.professional, 'Professional');
    return { ...toOfferDto(offer), professional: summary, distanceKm: distanceKm(pro, request) };
  });
}

type SummaryRequest = Pick<
  RequestDoc,
  '_id' | 'customer' | 'categoryId' | 'description' | 'urgency' | 'status' | 'location' | 'preferredSchedule' | 'offerCount' | 'pendingOfferCount' | 'acceptedOffer' | 'createdAt'
>;
const SUMMARY_REQUEST_PROJECTION = {
  customer: 1,
  categoryId: 1,
  description: 1,
  urgency: 1,
  status: 1,
  location: 1,
  preferredSchedule: 1,
  offerCount: 1,
  pendingOfferCount: 1,
  acceptedOffer: 1,
  createdAt: 1,
} as const;

export function toOfferRequestSummary(request: SummaryRequest, revealLocation: boolean): OfferRequestSummary {
  const location = toServiceLocation(request.location);
  const id = request._id.toHexString();
  return {
    id,
    categoryId: request.categoryId,
    description: request.description,
    urgency: request.urgency,
    status: request.status,
    location: revealLocation ? location : approximateLocation(location, id),
    preferredSchedule: request.preferredSchedule ? { ...request.preferredSchedule } : null,
    offerCount: request.offerCount,
    pendingOfferCount: request.pendingOfferCount,
    createdAt: request.createdAt.toISOString(),
  };
}

/** Owner customer, or the professional whose offer was accepted. */
async function locationRevealer(requests: SummaryRequest[], viewer: AuthContext): Promise<(request: SummaryRequest) => boolean> {
  if (viewer.role === 'customer') return (request) => request.customer.equals(viewer.userId);
  const accepted = await loadByIds<OfferDoc, Pick<OfferDoc, '_id' | 'professional'>>(
    OfferModel,
    requests.map((request) => request.acceptedOffer),
    { professional: 1 },
  );
  return (request) => {
    const offer = request.acceptedOffer ? accepted.get(request.acceptedOffer.toHexString()) : undefined;
    return offer?.professional.equals(viewer.userId) ?? false;
  };
}

/** Offers with their request summary (the professional's offers list, dashboard). */
export async function toOffersWithRequest(offers: OfferDoc[], viewer: AuthContext): Promise<OfferWithRequest[]> {
  const requests = await loadByIds<RequestDoc, SummaryRequest>(RequestModel, offers.map((offer) => offer.request), SUMMARY_REQUEST_PROJECTION);
  const reveals = await locationRevealer([...requests.values()], viewer);
  return offers.map((offer) => {
    const request = required(requests, offer.request, 'Request');
    return { ...toOfferDto(offer), request: toOfferRequestSummary(request, reveals(request)) };
  });
}

/** `GET /offers/:id`: the offer with its professional and the request summary. */
export async function toOfferDetails(offer: OfferDoc, request: RequestDoc, viewer: AuthContext): Promise<OfferDetails> {
  const [withProfessional] = await toOffersWithProfessional([offer], request);
  if (!withProfessional) throw new Error(`Offer ${offer._id.toHexString()} has no view`);
  const reveals = await locationRevealer([request], viewer);
  return { ...withProfessional, request: toOfferRequestSummary(request, reveals(request)) };
}
