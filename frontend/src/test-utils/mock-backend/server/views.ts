/**
 * Response views: turn stored rows into the DTOs of the REST contract, applying per-viewer
 * privacy rules (approximate locations, stripped private settings, per-viewer unread counts).
 */
import { computeRequestOfferStats } from './offer-counters';
import {
  approximateLocation,
  distanceFromServiceAreaKm,
  isRequestMatchForProfessional,
} from './request-matching';
import type {
  Conversation,
  CustomerRequestView,
  CustomerSummary,
  Job,
  JobDetails,
  JobSummary,
  MyOfferSummary,
  Offer,
  OfferWithProfessional,
  OfferWithRequest,
  OwnProfessionalProfile,
  ProfessionalProfile,
  ProfessionalRequestView,
  ProfessionalSummary,
  ServiceRequest,
  User,
} from '@/types/domain';

import type { Actor } from './auth';
import type { ServerContext } from './context';
import type { StoredConversation, StoredJob, StoredUser } from './db';
import {
  customerShortName,
  messagesForConversation,
  offersForRequest,
  relevantOfferOf,
  requireProfessional,
  requireRequest,
  requireStoredUser,
  reviewForJob,
} from './queries';
import { findMatchingProfessionals } from './services/matching-service';

// ────────────────────────────── Users & profiles ──────────────────────────────

export function toUser(stored: StoredUser): User {
  return { ...stored };
}

export function toJob(stored: StoredJob): Job {
  const { reminderSentAt: _reminderSentAt, ...job } = stored;
  return job;
}

export function professionalCity(profile: Pick<ProfessionalProfile, 'baseLocation' | 'serviceArea'>): string {
  return profile.baseLocation?.city ?? profile.serviceArea.label;
}

export function toProfessionalSummary(profile: ProfessionalProfile): ProfessionalSummary {
  return {
    id: profile.id,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    headline: profile.headline,
    categoryIds: [...profile.categoryIds],
    yearsOfExperience: profile.yearsOfExperience,
    averageRating: profile.stats.averageRating,
    reviewCount: profile.stats.reviewCount,
    completedJobsCount: profile.stats.completedJobsCount,
    isVerified: profile.isVerified,
    city: professionalCity(profile),
  };
}

/** Whether `viewer` may see the professional's contact details: they hired them (or it's them). */
function canSeeProfessionalContact(ctx: ServerContext, profile: OwnProfessionalProfile, viewer: Actor): boolean {
  if (viewer.role === 'professional') return viewer.professional.id === profile.id;
  return ctx.db.jobs.find((job) => job.professionalId === profile.id && job.customerId === viewer.userId) !== undefined;
}

/**
 * Public profile, as `viewer` sees it: private notification settings are stripped, the base
 * address and the service-area center are approximate (a professional's base is often their home),
 * and the contact details (phone and sign-in-style email) only reach customers who hired them.
 */
export function toPublicProfessionalProfile(ctx: ServerContext, profile: OwnProfessionalProfile, viewer: Actor): ProfessionalProfile {
  const { notificationPreferences: _notificationPreferences, ...publicProfile } = profile;
  if (viewer.role === 'professional' && viewer.professional.id === profile.id) return publicProfile;
  const { center, label } = profile.serviceArea;
  const approximateCenter = approximateLocation(
    { coordinates: center, addressLine: '', city: label, neighborhood: null, details: null, isApproximate: false },
    profile.id,
  ).coordinates;
  return {
    ...publicProfile,
    serviceArea: { ...profile.serviceArea, center: approximateCenter },
    baseLocation: profile.baseLocation ? approximateLocation(profile.baseLocation, profile.id) : null,
    contact: canSeeProfessionalContact(ctx, profile, viewer) ? profile.contact : null,
  };
}

function toCustomerSummary(ctx: ServerContext, customerId: string): CustomerSummary {
  const user = requireStoredUser(ctx.db, customerId);
  const profile = ctx.db.customerProfiles.get(customerId);
  return {
    id: user.id,
    displayName: customerShortName(user),
    avatarUrl: user.avatarUrl,
    city: profile?.defaultLocation?.city ?? null,
    memberSince: user.createdAt,
    completedJobsCount: profile?.stats.completedJobsCount ?? 0,
  };
}

// ────────────────────────────── Requests ──────────────────────────────

export function toCustomerRequestView(ctx: ServerContext, request: ServiceRequest): CustomerRequestView {
  const stats = computeRequestOfferStats(offersForRequest(ctx.db, request.id));
  return {
    ...request,
    latestOfferAt: stats.latestOfferAt,
    lowestOfferPrice: stats.lowestOfferPrice,
    // The real server stores the count of its publish fan-out; the double counts the matches now.
    matchedProfessionalCount: request.publishedAt ? findMatchingProfessionals(ctx, request).length : null,
  };
}

function toMyOfferSummary(offer: Offer | undefined): MyOfferSummary | null {
  if (!offer) return null;
  return {
    offerId: offer.id,
    status: offer.status,
    price: offer.price,
    currency: offer.currency,
    proposedStartAt: offer.proposedStartAt,
  };
}

/** Whether the professional was hired for the request (their offer was accepted). */
function isSelectedProfessional(request: ServiceRequest, professionalId: string, ctx: ServerContext): boolean {
  if (!request.acceptedOfferId) return false;
  return ctx.db.offers.get(request.acceptedOfferId)?.professionalId === professionalId;
}

/**
 * Request as seen by a professional. The exact address and the customer's notes (access details
 * such as building codes and parking) stay hidden until the professional's offer is accepted;
 * distance is measured to the real location.
 */
export function toProfessionalRequestView(
  ctx: ServerContext,
  request: ServiceRequest,
  professional: OwnProfessionalProfile,
): ProfessionalRequestView {
  const selected = isSelectedProfessional(request, professional.id, ctx);
  return {
    ...request,
    location: selected ? request.location : approximateLocation(request.location, request.id),
    notes: selected ? request.notes : null,
    jobId: selected ? request.jobId : null,
    distanceKm: distanceFromServiceAreaKm(professional.serviceArea, request.location.coordinates),
    customer: toCustomerSummary(ctx, request.customerId),
    myOffer: toMyOfferSummary(relevantOfferOf(ctx.db, request.id, professional.id)),
    isMatch: isRequestMatchForProfessional(request, professional),
  };
}

// ────────────────────────────── Offers ──────────────────────────────

export function toOfferWithProfessional(ctx: ServerContext, offer: Offer, request?: ServiceRequest): OfferWithProfessional {
  const professional = requireProfessional(ctx.db, offer.professionalId);
  const target = request ?? requireRequest(ctx.db, offer.requestId);
  return {
    ...offer,
    professional: toProfessionalSummary(professional),
    distanceKm: distanceFromServiceAreaKm(professional.serviceArea, target.location.coordinates),
  };
}

type OfferRequestSummary = OfferWithRequest['request'];

/** Request fields embedded in offer views; the location is redacted for professionals not hired. */
export function toOfferRequestSummary(ctx: ServerContext, request: ServiceRequest, viewer: Actor): OfferRequestSummary {
  const revealLocation =
    viewer.role === 'customer' ? viewer.userId === request.customerId : isSelectedProfessional(request, viewer.professional.id, ctx);
  return {
    id: request.id,
    categoryId: request.categoryId,
    description: request.description,
    urgency: request.urgency,
    status: request.status,
    location: revealLocation ? request.location : approximateLocation(request.location, request.id),
    preferredSchedule: request.preferredSchedule,
    offerCount: request.offerCount,
    pendingOfferCount: request.pendingOfferCount,
    createdAt: request.createdAt,
  };
}

export function toOfferWithRequest(ctx: ServerContext, offer: Offer, viewer: Actor): OfferWithRequest {
  return { ...offer, request: toOfferRequestSummary(ctx, requireRequest(ctx.db, offer.requestId), viewer) };
}

// ────────────────────────────── Jobs ──────────────────────────────

export function toJobSummary(ctx: ServerContext, job: StoredJob): JobSummary {
  const request = requireRequest(ctx.db, job.requestId);
  return {
    ...toJob(job),
    description: request.description,
    professional: toProfessionalSummary(requireProfessional(ctx.db, job.professionalId)),
    customer: toCustomerSummary(ctx, job.customerId),
  };
}

export function toJobDetails(ctx: ServerContext, job: StoredJob, viewer: Actor): JobDetails {
  const review = reviewForJob(ctx.db, job.id) ?? null;
  return {
    ...toJobSummary(ctx, job),
    request: requireRequest(ctx.db, job.requestId),
    review,
    canReview: viewer.role === 'customer' && viewer.userId === job.customerId && job.status === 'completed' && review === null,
  };
}

// ────────────────────────────── Conversations ──────────────────────────────

export function toConversation(ctx: ServerContext, conversation: StoredConversation, viewerUserId: string): Conversation {
  const messages = messagesForConversation(ctx.db, conversation.id);
  return {
    id: conversation.id,
    jobId: conversation.jobId,
    requestId: conversation.requestId,
    participants: conversation.participants.map(({ userId, role }) => {
      const user = requireStoredUser(ctx.db, userId);
      return { userId, role, displayName: user.displayName, avatarUrl: user.avatarUrl };
    }),
    lastMessage: messages.length > 0 ? messages[messages.length - 1] : null,
    unreadCount: messages.filter((message) => message.senderId !== viewerUserId && message.readAt === null).length,
    isOpen: conversation.isOpen,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
}
