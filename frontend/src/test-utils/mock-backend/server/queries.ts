/** Read helpers over the mock database (no side effects). */
import { isOfferActive } from '@/features/offers/offer-status-machine';
import type { Message, Offer, OwnProfessionalProfile, Review, ServiceRequest } from '@/types/domain';
import { compareIds } from '@/utils/id';

import type { MockDatabase, StoredConversation, StoredJob, StoredUser } from './db';

const byCreatedAt = <T extends { createdAt: string; id: string }>(a: T, b: T) =>
  Date.parse(a.createdAt) - Date.parse(b.createdAt) || compareIds(a.id, b.id);

export const requireRequest = (db: MockDatabase, id: string): ServiceRequest => db.requests.require(id, 'Request');
export const requireOffer = (db: MockDatabase, id: string): Offer => db.offers.require(id, 'Offer');
export const requireJob = (db: MockDatabase, id: string): StoredJob => db.jobs.require(id, 'Job');
export const requireConversation = (db: MockDatabase, id: string): StoredConversation =>
  db.conversations.require(id, 'Conversation');
export const requireProfessional = (db: MockDatabase, id: string): OwnProfessionalProfile =>
  db.professionals.require(id, 'Professional');
export const requireStoredUser = (db: MockDatabase, id: string): StoredUser => db.users.require(id, 'User');

export function findProfessionalByUserId(db: MockDatabase, userId: string): OwnProfessionalProfile | undefined {
  return db.professionals.find((profile) => profile.userId === userId);
}

/** Offers on a request, oldest first. */
export function offersForRequest(db: MockDatabase, requestId: string): Offer[] {
  return db.offers.filter((offer) => offer.requestId === requestId).sort(byCreatedAt);
}

/** The professional's pending/accepted offer on a request, if any. */
export function activeOfferOf(db: MockDatabase, requestId: string, professionalId: string): Offer | undefined {
  return db.offers.find(
    (offer) => offer.requestId === requestId && offer.professionalId === professionalId && isOfferActive(offer.status),
  );
}

/** The professional's most relevant offer on a request: the active one, otherwise the newest. */
export function relevantOfferOf(db: MockDatabase, requestId: string, professionalId: string): Offer | undefined {
  const active = activeOfferOf(db, requestId, professionalId);
  if (active) return active;
  const offers = db.offers.filter((offer) => offer.requestId === requestId && offer.professionalId === professionalId);
  offers.sort(byCreatedAt);
  return offers[offers.length - 1];
}

/** Ids of requests on which the professional has an active offer. */
export function activeOfferRequestIds(db: MockDatabase, professionalId: string): Set<string> {
  return new Set(
    db.offers
      .filter((offer) => offer.professionalId === professionalId && isOfferActive(offer.status))
      .map((offer) => offer.requestId),
  );
}

export function reviewForJob(db: MockDatabase, jobId: string): Review | undefined {
  return db.reviews.find((review) => review.jobId === jobId);
}

/** Messages of a conversation, oldest first. */
export function messagesForConversation(db: MockDatabase, conversationId: string): Message[] {
  return db.messages.filter((message) => message.conversationId === conversationId).sort(byCreatedAt);
}

/** User id of the professional behind a profile id. */
export function professionalUserId(db: MockDatabase, professionalId: string): string {
  return requireProfessional(db, professionalId).userId;
}

/** Privacy-friendly customer name shown to professionals, e.g. "Noa L.". */
export function customerShortName(user: Pick<StoredUser, 'firstName' | 'lastName' | 'displayName'>): string {
  const first = user.firstName.trim();
  const lastInitial = user.lastName.trim().charAt(0);
  if (!first) return user.displayName;
  return lastInitial ? `${first} ${lastInitial}.` : first;
}
