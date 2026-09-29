/**
 * Every state change of requests, offers and jobs goes through this module. It enforces the
 * shared state machines (`src/features/*`), keeps denormalized counters consistent and triggers
 * notifications + realtime events. Operations are atomic because the server runs each one inside
 * a database transaction (see `context.ts`).
 */
import { APP_CONFIG } from '@/constants/app-config';
import { validateOfferAgainstRequest } from '@/features/offers/offer-rules';
import { computeRequestOfferStats } from '@/features/offers/offer-counters';
import {
  assertOfferTransition,
  computeOfferExpiry,
  getOfferAcceptBlocker,
  isOfferExpired,
} from '@/features/offers/offer-status-machine';
import { assertJobTransition, requestStatusForJobStatus } from '@/features/jobs/job-status-machine';
import { professionalCoversCategory, isWithinServiceArea } from '@/features/requests/request-matching';
import {
  assertRequestTransition,
  requestAcceptsOffers,
  requestStatusForPendingOffers,
} from '@/features/requests/request-status-machine';
import { DomainError } from '@/features/shared/domain-error';
import { vm } from '@/lib/validation/messages';
import { cancelRequestSchema } from '@/lib/validation/cancel';
import { createOfferSchema, updateOfferSchema } from '@/lib/validation/offer';
import {
  createServiceRequestSchema,
  updateDraftRequestSchema,
  validatePreferredDateForUrgency,
} from '@/lib/validation/request';
import type { AcceptOfferResponse, CreateServiceRequestPayload } from '@/types/api';
import type {
  CurrencyCode,
  ISODateTimeString,
  Offer,
  PreferredSchedule,
  RequestPhoto,
  RequestStatus,
  ServiceLocation,
  ServiceRequest,
  UrgencyLevel,
} from '@/types/domain';

import type { Actor, CustomerActor, ProfessionalActor } from '../auth';
import type { ServerContext } from '../context';
import type { StoredJob } from '../db';
import {
  activeOfferOf,
  customerShortName,
  offersForRequest,
  professionalUserId,
  requireJob,
  requireOffer,
  requireProfessional,
  requireRequest,
  requireStoredUser,
} from '../queries';
import { parseBody } from '../validate';
import { toJob } from '../views';
import { findMatchingProfessionals } from './matching-service';
import { closeConversation, createConversationForJob } from './messaging-service';
import { emitJobUpdated, emitOfferUpdated, emitRequestUpdated, notify } from './notification-service';
import { recomputeCustomerStats, recomputeProfessionalStats } from './review-service';

// ────────────────────────────── Shared helpers ──────────────────────────────

function requireOwnedRequest(ctx: ServerContext, actor: CustomerActor, requestId: string): ServiceRequest {
  const request = requireRequest(ctx.db, requestId);
  if (request.customerId !== actor.userId) throw DomainError.forbidden('This request belongs to another customer');
  return request;
}

/** Moves a request to `to` (validated by the state machine) and applies `patch`. */
function setRequestStatus(
  ctx: ServerContext,
  request: ServiceRequest,
  to: RequestStatus,
  patch: Partial<ServiceRequest> = {},
): ServiceRequest {
  if (request.status !== to) assertRequestTransition(request.status, to);
  return ctx.db.requests.update(request.id, { ...patch, status: to, updatedAt: ctx.nowIso() });
}

/**
 * Recomputes `offerCount` / `pendingOfferCount` and flips `open ⇄ offers_received` when the number
 * of pending offers crosses zero.
 */
function syncRequestOffers(ctx: ServerContext, requestId: string): ServiceRequest {
  const request = requireRequest(ctx.db, requestId);
  const stats = computeRequestOfferStats(offersForRequest(ctx.db, requestId));
  const status = requestStatusForPendingOffers(request.status, stats.pendingOfferCount);
  if (
    status === request.status &&
    stats.offerCount === request.offerCount &&
    stats.pendingOfferCount === request.pendingOfferCount
  ) {
    return request;
  }
  return setRequestStatus(ctx, request, status, {
    offerCount: stats.offerCount,
    pendingOfferCount: stats.pendingOfferCount,
  });
}

function toServiceLocation(location: CreateServiceRequestPayload['location']): ServiceLocation {
  return {
    coordinates: { latitude: location.coordinates.latitude, longitude: location.coordinates.longitude },
    addressLine: location.addressLine,
    city: location.city,
    neighborhood: location.neighborhood,
    details: location.details,
    isApproximate: false,
  };
}

function resolvePhotos(ctx: ServerContext, ownerId: string, photoIds: readonly string[]): RequestPhoto[] {
  const photos: RequestPhoto[] = [];
  for (const photoId of photoIds) {
    const upload = ctx.db.uploads.get(photoId);
    if (!upload || upload.ownerId !== ownerId) {
      throw DomainError.validation({ photoIds: [vm('request.photoNotFound')] }, `Unknown photo "${photoId}"`);
    }
    photos.push({ id: upload.id, url: upload.url, width: upload.width, height: upload.height });
  }
  return photos;
}

function assertPreferredSchedule(ctx: ServerContext, schedule: PreferredSchedule | null | undefined, urgency: UrgencyLevel): void {
  if (!schedule) return;
  const issue = validatePreferredDateForUrgency(schedule.date, urgency, ctx.now());
  if (issue) throw DomainError.validation({ 'preferredSchedule.date': [issue] });
}

function assertSupportedCurrency(currency: CurrencyCode | undefined): void {
  if (currency !== undefined && currency !== APP_CONFIG.defaultCurrency) {
    throw DomainError.validation({ currency: [vm('offer.currencyUnsupported')] });
  }
}

function assertOfferTime(ctx: ServerContext, request: ServiceRequest, proposedStartAt: ISODateTimeString): void {
  const result = validateOfferAgainstRequest({ proposedStartAt, request, now: ctx.now() });
  if (!result.isValid) {
    throw DomainError.validation({ proposedStartAt: result.errors.map((issue) => issue.message) }, 'The proposed time is not allowed');
  }
}

function customerNameOf(ctx: ServerContext, customerId: string): string {
  return customerShortName(requireStoredUser(ctx.db, customerId));
}

/**
 * Professionals whose explorer (map, list, dashboard) shows the request while it accepts offers.
 * They get `request.updated` whenever the request enters or leaves the explorer, not only those
 * who already sent an offer.
 */
function explorerAudience(ctx: ServerContext, request: ServiceRequest): string[] {
  if (!requestAcceptsOffers(request.status)) return [];
  return findMatchingProfessionals(ctx, request).map(({ professional }) => professional.userId);
}

// ────────────────────────────── Requests ──────────────────────────────

function publish(ctx: ServerContext, request: ServiceRequest): ServiceRequest {
  assertRequestTransition(request.status, 'open');
  assertPreferredSchedule(ctx, request.preferredSchedule, request.urgency);
  const now = ctx.nowIso();
  const published = setRequestStatus(ctx, request, 'open', { publishedAt: now });
  const customerName = customerNameOf(ctx, published.customerId);
  const matches = findMatchingProfessionals(ctx, published);
  for (const { professional, distanceKm } of matches) {
    notify(ctx, professional.userId, { type: 'new_matching_request', request: published, customerName, distanceKm });
  }
  emitRequestUpdated(ctx, published, explorerAudience(ctx, published));
  recomputeCustomerStats(ctx, published.customerId);
  ctx.hooks.onRequestPublished(ctx, published.id);
  return published;
}

/** `POST /requests` – creates a draft or a published request. */
export function createRequest(ctx: ServerContext, actor: CustomerActor, body: unknown): ServiceRequest {
  const payload = parseBody(createServiceRequestSchema, body);
  assertPreferredSchedule(ctx, payload.preferredSchedule, payload.urgency);
  const now = ctx.nowIso();
  const draft = ctx.db.requests.insert({
    id: ctx.newId('req'),
    customerId: actor.userId,
    categoryId: payload.categoryId,
    description: payload.description,
    location: toServiceLocation(payload.location),
    urgency: payload.urgency,
    preferredSchedule: payload.preferredSchedule,
    photos: resolvePhotos(ctx, actor.userId, payload.photoIds),
    notes: payload.notes,
    status: 'draft',
    offerCount: 0,
    pendingOfferCount: 0,
    acceptedOfferId: null,
    jobId: null,
    publishedAt: null,
    cancelledAt: null,
    cancellationReason: null,
    cancellationComment: null,
    createdAt: now,
    updatedAt: now,
  });
  if (payload.publish) return publish(ctx, draft);
  emitRequestUpdated(ctx, draft);
  return draft;
}

/** `PATCH /requests/:id` – drafts only. */
export function updateDraftRequest(ctx: ServerContext, actor: CustomerActor, requestId: string, body: unknown): ServiceRequest {
  const request = requireOwnedRequest(ctx, actor, requestId);
  if (request.status !== 'draft') throw DomainError.conflict('Only drafts can be edited');
  const payload = parseBody(updateDraftRequestSchema, body);
  if (payload.preferredSchedule !== undefined || payload.urgency !== undefined) {
    assertPreferredSchedule(
      ctx,
      payload.preferredSchedule !== undefined ? payload.preferredSchedule : request.preferredSchedule,
      payload.urgency ?? request.urgency,
    );
  }
  const updated = ctx.db.requests.update(request.id, {
    ...(payload.categoryId !== undefined ? { categoryId: payload.categoryId } : {}),
    ...(payload.description !== undefined ? { description: payload.description } : {}),
    ...(payload.location !== undefined ? { location: toServiceLocation(payload.location) } : {}),
    ...(payload.urgency !== undefined ? { urgency: payload.urgency } : {}),
    ...(payload.preferredSchedule !== undefined ? { preferredSchedule: payload.preferredSchedule } : {}),
    ...(payload.photoIds !== undefined ? { photos: resolvePhotos(ctx, actor.userId, payload.photoIds) } : {}),
    ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
    updatedAt: ctx.nowIso(),
  });
  emitRequestUpdated(ctx, updated);
  return updated;
}

/** `POST /requests/:id/publish` */
export function publishRequest(ctx: ServerContext, actor: CustomerActor, requestId: string): ServiceRequest {
  return publish(ctx, requireOwnedRequest(ctx, actor, requestId));
}

/** `DELETE /requests/:id` – drafts only. */
export function deleteDraftRequest(ctx: ServerContext, actor: CustomerActor, requestId: string): void {
  const request = requireOwnedRequest(ctx, actor, requestId);
  if (request.status !== 'draft') throw DomainError.conflict('Only drafts can be deleted');
  ctx.db.requests.delete(request.id);
  ctx.emit(actor.userId, { type: 'request.updated', requestId: request.id });
}

/**
 * `POST /requests/:id/cancel` – cascades: pending offers are rejected, an assigned job is cancelled
 * (and its chat closed), and every affected professional is notified.
 */
export function cancelRequest(ctx: ServerContext, actor: CustomerActor, requestId: string, body: unknown): ServiceRequest {
  const payload = parseBody(cancelRequestSchema, body);
  const request = requireOwnedRequest(ctx, actor, requestId);
  assertRequestTransition(request.status, 'cancelled');
  const job = request.jobId ? requireJob(ctx.db, request.jobId) : undefined;
  if (job && job.status !== 'cancelled') assertJobTransition(job.status, 'cancelled');
  const leavesExplorer = explorerAudience(ctx, request);

  const now = ctx.nowIso();
  const customerName = customerNameOf(ctx, request.customerId);
  const professionalsToNotify = new Set<string>();
  const changedOffers: Offer[] = [];

  for (const offer of offersForRequest(ctx.db, request.id).filter((candidate) => candidate.status === 'pending')) {
    assertOfferTransition(offer.status, 'rejected');
    changedOffers.push(
      ctx.db.offers.update(offer.id, { status: 'rejected', statusReason: 'request_cancelled', respondedAt: now, updatedAt: now }),
    );
    professionalsToNotify.add(professionalUserId(ctx.db, offer.professionalId));
  }

  let cancelledJob: StoredJob | undefined;
  if (job && job.status !== 'cancelled') {
    cancelledJob = ctx.db.jobs.update(job.id, { status: 'cancelled', cancelledAt: now, updatedAt: now });
    closeConversation(ctx, job.conversationId);
    professionalsToNotify.add(professionalUserId(ctx.db, job.professionalId));
  }

  const stats = computeRequestOfferStats(offersForRequest(ctx.db, request.id));
  const cancelled = setRequestStatus(ctx, request, 'cancelled', {
    cancelledAt: now,
    cancellationReason: payload.reason,
    cancellationComment: payload.comment,
    offerCount: stats.offerCount,
    pendingOfferCount: stats.pendingOfferCount,
  });

  professionalsToNotify.forEach((userId) =>
    notify(ctx, userId, { type: 'request_cancelled', request: cancelled, customerName }),
  );
  changedOffers.forEach((offer) => emitOfferUpdated(ctx, offer));
  if (cancelledJob) emitJobUpdated(ctx, cancelledJob);
  emitRequestUpdated(ctx, cancelled, leavesExplorer);
  recomputeCustomerStats(ctx, cancelled.customerId);
  return cancelled;
}

// ────────────────────────────── Offers ──────────────────────────────

/** `POST /requests/:id/offers` */
export function submitOffer(ctx: ServerContext, actor: ProfessionalActor, requestId: string, body: unknown): Offer {
  const payload = parseBody(createOfferSchema, body);
  const professional = requireProfessional(ctx.db, actor.professional.id);
  const request = requireRequest(ctx.db, requestId);
  if (request.status === 'draft') throw DomainError.notFound('Request', requestId);
  if (!requestAcceptsOffers(request.status)) {
    throw DomainError.conflict('This request no longer accepts offers', 'REQUEST_NOT_ACCEPTING_OFFERS');
  }
  if (!professionalCoversCategory(professional, request.categoryId)) {
    throw DomainError.validation(
      { categoryId: [vm('category.notOffered')] },
      'You do not offer this service category',
      'UNSUPPORTED_CATEGORY',
    );
  }
  if (!isWithinServiceArea(professional.serviceArea, request.location.coordinates)) {
    throw DomainError.validation(
      { location: [vm('location.outsideServiceArea')] },
      'The request is outside your service area',
      'OUTSIDE_SERVICE_AREA',
    );
  }
  if (activeOfferOf(ctx.db, request.id, professional.id)) {
    throw DomainError.conflict('You already have an active offer on this request', 'DUPLICATE_OFFER');
  }
  assertSupportedCurrency(payload.currency);
  assertOfferTime(ctx, request, payload.proposedStartAt);

  const now = ctx.nowIso();
  const offer = ctx.db.offers.insert({
    id: ctx.newId('off'),
    requestId: request.id,
    professionalId: professional.id,
    price: payload.price,
    currency: payload.currency,
    proposedStartAt: new Date(payload.proposedStartAt).toISOString(),
    estimatedDurationMinutes: payload.estimatedDurationMinutes,
    message: payload.message,
    status: 'pending',
    statusReason: null,
    expiresAt: computeOfferExpiry(request.urgency, payload.proposedStartAt, now),
    createdAt: now,
    updatedAt: now,
    respondedAt: null,
  });
  const updatedRequest = syncRequestOffers(ctx, request.id);
  notify(ctx, updatedRequest.customerId, {
    type: 'offer_received',
    offer,
    categoryId: request.categoryId,
    professionalName: professional.displayName,
  });
  emitOfferUpdated(ctx, offer);
  emitRequestUpdated(ctx, updatedRequest);
  recomputeProfessionalStats(ctx, professional.id);
  return offer;
}

function requireOwnOffer(ctx: ServerContext, actor: ProfessionalActor, offerId: string): Offer {
  const offer = requireOffer(ctx.db, offerId);
  if (offer.professionalId !== actor.professional.id) throw DomainError.forbidden('This offer belongs to another professional');
  return offer;
}

function assertOfferEditable(ctx: ServerContext, offer: Offer, request: ServiceRequest): void {
  if (offer.status === 'expired' || isOfferExpired(offer, ctx.now())) {
    throw DomainError.conflict('This offer has expired', 'OFFER_EXPIRED');
  }
  if (offer.status !== 'pending') throw DomainError.invalidTransition('offer', offer.status, 'pending');
  if (!requestAcceptsOffers(request.status)) {
    throw DomainError.conflict('This request no longer accepts offers', 'REQUEST_NOT_ACCEPTING_OFFERS');
  }
}

/** `PATCH /offers/:id` – pending offers only; the expiry restarts from now. */
export function updateOffer(ctx: ServerContext, actor: ProfessionalActor, offerId: string, body: unknown): Offer {
  const offer = requireOwnOffer(ctx, actor, offerId);
  const request = requireRequest(ctx.db, offer.requestId);
  assertOfferEditable(ctx, offer, request);
  const payload = parseBody(updateOfferSchema, body);
  assertSupportedCurrency(payload.currency);
  if (payload.proposedStartAt !== undefined) assertOfferTime(ctx, request, payload.proposedStartAt);

  const now = ctx.nowIso();
  const proposedStartAt =
    payload.proposedStartAt !== undefined ? new Date(payload.proposedStartAt).toISOString() : offer.proposedStartAt;
  const updated = ctx.db.offers.update(offer.id, {
    ...(payload.price !== undefined ? { price: payload.price } : {}),
    ...(payload.currency !== undefined ? { currency: payload.currency } : {}),
    ...(payload.estimatedDurationMinutes !== undefined ? { estimatedDurationMinutes: payload.estimatedDurationMinutes } : {}),
    ...(payload.message !== undefined ? { message: payload.message } : {}),
    proposedStartAt,
    expiresAt: computeOfferExpiry(request.urgency, proposedStartAt, now),
    updatedAt: now,
  });
  const professional = requireProfessional(ctx.db, offer.professionalId);
  notify(ctx, request.customerId, {
    type: 'offer_updated',
    offer: updated,
    categoryId: request.categoryId,
    professionalName: professional.displayName,
  });
  emitOfferUpdated(ctx, updated);
  emitRequestUpdated(ctx, request);
  return updated;
}

/** `POST /offers/:id/withdraw` */
export function withdrawOffer(ctx: ServerContext, actor: ProfessionalActor, offerId: string): Offer {
  const offer = requireOwnOffer(ctx, actor, offerId);
  if (offer.status === 'expired') throw DomainError.conflict('This offer has expired', 'OFFER_EXPIRED');
  assertOfferTransition(offer.status, 'withdrawn');
  const now = ctx.nowIso();
  const withdrawn = ctx.db.offers.update(offer.id, {
    status: 'withdrawn',
    statusReason: 'withdrawn_by_professional',
    updatedAt: now,
  });
  const request = syncRequestOffers(ctx, offer.requestId);
  notify(ctx, request.customerId, {
    type: 'offer_withdrawn',
    offer: withdrawn,
    categoryId: request.categoryId,
    professionalName: requireProfessional(ctx.db, offer.professionalId).displayName,
  });
  emitOfferUpdated(ctx, withdrawn);
  emitRequestUpdated(ctx, request);
  return withdrawn;
}

/**
 * `POST /offers/:id/accept` – atomically accepts one offer, rejects all other pending offers,
 * selects the professional on the request and creates the job and its conversation.
 * A request can only ever have one accepted offer (second attempts → 409 CONFLICT).
 */
export function acceptOffer(ctx: ServerContext, actor: CustomerActor, offerId: string): AcceptOfferResponse {
  const offer = requireOffer(ctx.db, offerId);
  const request = requireOwnedRequest(ctx, actor, offer.requestId);
  // Same rule as the customer's Accept buttons; each blocker maps to its REST error.
  switch (getOfferAcceptBlocker(offer, request, ctx.now())) {
    case 'already_accepted':
      throw DomainError.conflict('An offer has already been accepted for this request', 'CONFLICT');
    case 'offer_expired':
      throw DomainError.conflict('This offer has expired', 'OFFER_EXPIRED');
    case 'offer_not_pending':
      throw DomainError.invalidTransition('offer', offer.status, 'accepted');
    case 'request_closed':
      throw DomainError.conflict('This request no longer accepts offers', 'REQUEST_NOT_ACCEPTING_OFFERS');
    case null:
      break;
  }
  assertOfferTransition(offer.status, 'accepted');
  assertRequestTransition(request.status, requestStatusForJobStatus('awaiting_confirmation'));
  const professional = requireProfessional(ctx.db, offer.professionalId);
  const leavesExplorer = explorerAudience(ctx, request);

  const now = ctx.nowIso();
  const accepted = ctx.db.offers.update(offer.id, {
    status: 'accepted',
    statusReason: 'accepted_by_customer',
    respondedAt: now,
    updatedAt: now,
  });
  const rejected = offersForRequest(ctx.db, request.id)
    .filter((candidate) => candidate.id !== offer.id && candidate.status === 'pending')
    .map((candidate) => {
      assertOfferTransition(candidate.status, 'rejected');
      return ctx.db.offers.update(candidate.id, {
        status: 'rejected',
        statusReason: 'another_offer_accepted',
        respondedAt: now,
        updatedAt: now,
      });
    });

  const jobId = ctx.newId('job');
  const conversation = createConversationForJob(ctx, {
    jobId,
    requestId: request.id,
    customerId: request.customerId,
    professionalUserId: professional.userId,
  });
  const job = ctx.db.jobs.insert({
    id: jobId,
    requestId: request.id,
    offerId: accepted.id,
    customerId: request.customerId,
    professionalId: professional.id,
    conversationId: conversation.id,
    categoryId: request.categoryId,
    status: 'awaiting_confirmation',
    scheduledStartAt: accepted.proposedStartAt,
    estimatedDurationMinutes: accepted.estimatedDurationMinutes,
    agreedPrice: accepted.price,
    currency: accepted.currency,
    location: request.location,
    confirmedAt: null,
    startedAt: null,
    completedAt: null,
    completedBy: null,
    cancelledAt: null,
    reviewId: null,
    createdAt: now,
    updatedAt: now,
    reminderSentAt: null,
  });
  const stats = computeRequestOfferStats(offersForRequest(ctx.db, request.id));
  const updatedRequest = setRequestStatus(ctx, request, requestStatusForJobStatus(job.status), {
    acceptedOfferId: accepted.id,
    jobId: job.id,
    offerCount: stats.offerCount,
    pendingOfferCount: stats.pendingOfferCount,
  });

  const customerName = customerNameOf(ctx, request.customerId);
  notify(ctx, professional.userId, { type: 'offer_accepted', offer: accepted, job, customerName });
  for (const offerNotSelected of rejected) {
    notify(ctx, professionalUserId(ctx.db, offerNotSelected.professionalId), {
      type: 'offer_not_selected',
      offer: offerNotSelected,
      categoryId: request.categoryId,
      customerName,
    });
  }
  [accepted, ...rejected].forEach((changed) => emitOfferUpdated(ctx, changed));
  emitRequestUpdated(ctx, updatedRequest, leavesExplorer);
  emitJobUpdated(ctx, job);
  return { offer: accepted, request: updatedRequest, job: toJob(job) };
}

/** Marks an overdue pending offer as expired (used by the scheduler). */
export function expireOffer(ctx: ServerContext, offerId: string): Offer | null {
  const offer = requireOffer(ctx.db, offerId);
  if (offer.status !== 'pending') return null;
  assertOfferTransition(offer.status, 'expired');
  const expired = ctx.db.offers.update(offer.id, { status: 'expired', statusReason: 'expired', updatedAt: ctx.nowIso() });
  const request = syncRequestOffers(ctx, offer.requestId);
  notify(ctx, professionalUserId(ctx.db, offer.professionalId), {
    type: 'offer_expired',
    offer: expired,
    categoryId: request.categoryId,
  });
  emitOfferUpdated(ctx, expired);
  emitRequestUpdated(ctx, request);
  return expired;
}

// ────────────────────────────── Jobs ──────────────────────────────

function isJobParty(job: StoredJob, actor: Actor): boolean {
  return actor.role === 'customer' ? job.customerId === actor.userId : job.professionalId === actor.professional.id;
}

function requireJobOfProfessional(ctx: ServerContext, actor: ProfessionalActor, jobId: string): StoredJob {
  const job = requireJob(ctx.db, jobId);
  if (job.professionalId !== actor.professional.id) throw DomainError.forbidden('This job belongs to another professional');
  return job;
}

/** Applies a job transition and mirrors it onto the request. */
function transitionJob(ctx: ServerContext, job: StoredJob, to: StoredJob['status'], patch: Partial<StoredJob>): StoredJob {
  assertJobTransition(job.status, to);
  const request = requireRequest(ctx.db, job.requestId);
  const targetRequestStatus = requestStatusForJobStatus(to);
  if (request.status !== targetRequestStatus) assertRequestTransition(request.status, targetRequestStatus);
  const updated = ctx.db.jobs.update(job.id, { ...patch, status: to, updatedAt: ctx.nowIso() });
  const updatedRequest = setRequestStatus(ctx, request, targetRequestStatus);
  emitJobUpdated(ctx, updated);
  emitRequestUpdated(ctx, updatedRequest);
  return updated;
}

/** `POST /jobs/:id/confirm` – the professional confirms the appointment. */
export function confirmJob(ctx: ServerContext, actor: ProfessionalActor, jobId: string): StoredJob {
  const job = requireJobOfProfessional(ctx, actor, jobId);
  const confirmed = transitionJob(ctx, job, 'scheduled', { confirmedAt: ctx.nowIso() });
  notify(ctx, job.customerId, {
    type: 'job_confirmed',
    job: confirmed,
    professionalName: requireProfessional(ctx.db, job.professionalId).displayName,
  });
  return confirmed;
}

/** `POST /jobs/:id/start` */
export function startJob(ctx: ServerContext, actor: ProfessionalActor, jobId: string): StoredJob {
  const job = requireJobOfProfessional(ctx, actor, jobId);
  const started = transitionJob(ctx, job, 'in_progress', { startedAt: ctx.nowIso() });
  notify(ctx, job.customerId, {
    type: 'job_started',
    job: started,
    professionalName: requireProfessional(ctx.db, job.professionalId).displayName,
  });
  return started;
}

/** `POST /jobs/:id/complete` – either party; the other party is notified. */
export function completeJob(ctx: ServerContext, actor: Actor, jobId: string): StoredJob {
  const job = requireJob(ctx.db, jobId);
  if (!isJobParty(job, actor)) throw DomainError.forbidden('Only the parties of this job can complete it');
  const completed = transitionJob(ctx, job, 'completed', { completedAt: ctx.nowIso(), completedBy: actor.role });
  recomputeProfessionalStats(ctx, job.professionalId);
  recomputeCustomerStats(ctx, job.customerId);
  const professional = requireProfessional(ctx.db, job.professionalId);
  if (actor.role === 'professional') {
    notify(ctx, job.customerId, {
      type: 'job_completed',
      job: completed,
      recipientRole: 'customer',
      counterpartName: professional.displayName,
    });
  } else {
    notify(ctx, professional.userId, {
      type: 'job_completed',
      job: completed,
      recipientRole: 'professional',
      counterpartName: customerNameOf(ctx, job.customerId),
    });
  }
  return completed;
}
