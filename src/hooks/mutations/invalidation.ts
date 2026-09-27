/**
 * Centralized cache invalidation. Mutations and realtime events call these helpers so every
 * server-side change refreshes exactly the same set of queries, wherever it came from.
 *
 * All helpers are scoped to `userId` (the signed-in user) and return a promise that resolves when
 * the active queries have been refetched (callers usually don't await it).
 */
import type { QueryClient, QueryKey } from '@tanstack/react-query';

import { queryKeys } from '@/hooks/queries/query-keys';

type Invalidator = Pick<QueryClient, 'invalidateQueries'>;
type UserScope = string | null;

async function invalidateAll(qc: Invalidator, keys: readonly (QueryKey | null)[]): Promise<void> {
  await Promise.all(
    keys.filter((key): key is QueryKey => key !== null).map((queryKey) => qc.invalidateQueries({ queryKey })),
  );
}

/** Customer and professional dashboards. */
export function invalidateDashboards(qc: Invalidator, userId: UserScope): Promise<void> {
  return invalidateAll(qc, [queryKeys.dashboard.all(userId)]);
}

/**
 * A request changed (created, edited, published, cancelled, got offers…): its details and offers,
 * every request list (customer lists, nearby lists and the map) and the dashboards.
 * Without `requestId` every request detail is refreshed.
 */
export function invalidateRequestGraph(qc: Invalidator, userId: UserScope, requestId?: string | null): Promise<void> {
  return invalidateAll(qc, [
    requestId ? queryKeys.requests.detail(userId, requestId) : queryKeys.requests.details(userId),
    requestId ? queryKeys.offers.forRequestAll(userId, requestId) : null,
    queryKeys.requests.customerLists(userId),
    queryKeys.requests.nearbyLists(userId),
    queryKeys.dashboard.all(userId),
  ]);
}

export interface OfferRef {
  offerId?: string | null;
  requestId?: string | null;
}

/**
 * An offer changed (submitted, edited, withdrawn, accepted, rejected, expired): the offer, the
 * professional's offer lists, the request's offers and details (offer counts, `myOffer`), request
 * lists and dashboards.
 */
export function invalidateOfferGraph(qc: Invalidator, userId: UserScope, { offerId, requestId }: OfferRef): Promise<void> {
  return invalidateAll(qc, [
    offerId ? queryKeys.offers.detail(userId, offerId) : null,
    queryKeys.offers.professionalLists(userId),
    requestId ? queryKeys.offers.forRequestAll(userId, requestId) : null,
    requestId ? queryKeys.requests.detail(userId, requestId) : queryKeys.requests.details(userId),
    queryKeys.requests.customerLists(userId),
    queryKeys.requests.nearbyLists(userId),
    queryKeys.dashboard.all(userId),
  ]);
}

export interface JobRef {
  jobId?: string | null;
  requestId?: string | null;
}

/**
 * A job changed (created by accepting an offer, confirmed, started, completed, cancelled,
 * reviewed): the job, job lists, the mirrored request, conversations (opened/closed with the job)
 * and dashboards.
 */
export function invalidateJobGraph(qc: Invalidator, userId: UserScope, { jobId, requestId }: JobRef): Promise<void> {
  return invalidateAll(qc, [
    jobId ? queryKeys.jobs.detail(userId, jobId) : queryKeys.jobs.all(userId),
    queryKeys.jobs.lists(userId),
    requestId ? queryKeys.requests.detail(userId, requestId) : null,
    queryKeys.requests.customerLists(userId),
    queryKeys.conversations.list(userId),
    queryKeys.dashboard.all(userId),
  ]);
}

/** Notification lists, the unread count and the professional dashboard (recent notifications). */
export function invalidateNotifications(qc: Invalidator, userId: UserScope): Promise<void> {
  return invalidateAll(qc, [queryKeys.notifications.all(userId), queryKeys.dashboard.professional(userId)]);
}

/**
 * The conversation list and one conversation (unread counts, last message). Messages are only
 * refetched with `includeMessages` – new messages are normally appended to the cache instead.
 */
export function invalidateConversation(
  qc: Invalidator,
  userId: UserScope,
  conversationId?: string | null,
  options: { includeMessages?: boolean } = {},
): Promise<void> {
  return invalidateAll(qc, [
    queryKeys.conversations.list(userId),
    conversationId ? queryKeys.conversations.detail(userId, conversationId) : null,
    conversationId && options.includeMessages ? queryKeys.conversations.messages(userId, conversationId) : null,
  ]);
}

/** A professional's public data (profile, reviews, search results). Without an id: all of them. */
export function invalidateProfessional(qc: Invalidator, userId: UserScope, professionalId?: string | null): Promise<void> {
  return invalidateAll(
    qc,
    professionalId
      ? [
          queryKeys.professionals.profile(userId, professionalId),
          queryKeys.professionals.reviews(userId, professionalId),
          queryKeys.professionals.searches(userId),
        ]
      : [queryKeys.professionals.all(userId)],
  );
}

/**
 * The signed-in user's own identity and profile (`/me`, customer profile, own professional
 * profile). Professional profile changes (categories, service area) also change which requests
 * match, so nearby lists and dashboards are refreshed too.
 */
export function invalidateOwnProfile(qc: Invalidator, userId: UserScope): Promise<void> {
  return invalidateAll(qc, [
    queryKeys.auth.me(userId),
    queryKeys.customer.profile(userId),
    queryKeys.professionals.all(userId),
    queryKeys.requests.nearbyLists(userId),
    queryKeys.dashboard.all(userId),
  ]);
}

/** Everything cached for the user (e.g. after resetting the demo data). */
export function invalidateUserData(qc: Invalidator, userId: UserScope): Promise<void> {
  return invalidateAll(qc, [queryKeys.user(userId)]);
}
