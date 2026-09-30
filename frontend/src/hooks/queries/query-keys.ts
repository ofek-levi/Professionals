/**
 * Every React Query key used in the app is created here, so cache reads, writes and
 * invalidations always agree. Keys are hierarchical: invalidating `queryKeys.jobs.all`
 * invalidates every job related query.
 *
 * All user data keys start with `['u', userId]` so switching accounts can never show another
 * user's cached data.
 */
import type {
  CustomerRequestsParams,
  JobScope,
  NearbyRequestsParams,
  NotificationsParams,
  ProfessionalOffersParams,
  RequestOffersParams,
} from '@/types/api';

type Scope = string | null;

export const queryKeys = {
  /** Prefix of every query of one user (refetched after a realtime reconnect). */
  user: (userId: Scope) => ['u', userId] as const,

  auth: {
    me: (userId: Scope) => ['u', userId, 'me'] as const,
  },

  catalog: {
    categories: () => ['public', 'catalog', 'categories'] as const,
  },

  dashboard: {
    all: (userId: Scope) => ['u', userId, 'dashboard'] as const,
    customer: (userId: Scope) => ['u', userId, 'dashboard', 'customer'] as const,
    professional: (userId: Scope) => ['u', userId, 'dashboard', 'professional'] as const,
  },

  requests: {
    customerLists: (userId: Scope) => ['u', userId, 'requests', 'customer-list'] as const,
    customerList: (userId: Scope, params: CustomerRequestsParams) =>
      ['u', userId, 'requests', 'customer-list', params] as const,
    nearbyLists: (userId: Scope) => ['u', userId, 'requests', 'nearby'] as const,
    nearby: (userId: Scope, params: NearbyRequestsParams) => ['u', userId, 'requests', 'nearby', params] as const,
    /** Single-page map query; nested under `nearbyLists` so the same invalidation covers it. */
    nearbyMap: (userId: Scope, params: NearbyRequestsParams) => ['u', userId, 'requests', 'nearby', 'map', params] as const,
    details: (userId: Scope) => ['u', userId, 'requests', 'detail'] as const,
    detail: (userId: Scope, requestId: string) => ['u', userId, 'requests', 'detail', requestId] as const,
  },

  offers: {
    forRequest: (userId: Scope, requestId: string, params: RequestOffersParams = {}) =>
      ['u', userId, 'offers', 'request', requestId, params] as const,
    forRequestAll: (userId: Scope, requestId: string) => ['u', userId, 'offers', 'request', requestId] as const,
    detail: (userId: Scope, offerId: string) => ['u', userId, 'offers', 'detail', offerId] as const,
    professionalLists: (userId: Scope) => ['u', userId, 'offers', 'professional-list'] as const,
    professionalList: (userId: Scope, params: ProfessionalOffersParams) =>
      ['u', userId, 'offers', 'professional-list', params] as const,
  },

  jobs: {
    all: (userId: Scope) => ['u', userId, 'jobs'] as const,
    /** Prefix of every job list (all scopes). */
    lists: (userId: Scope) => ['u', userId, 'jobs', 'list'] as const,
    /** Infinite list of one scope; pages differ by size, so the page size is part of the key. */
    list: (userId: Scope, scope: JobScope, pageSize: number) => ['u', userId, 'jobs', 'list', scope, pageSize] as const,
    detail: (userId: Scope, jobId: string) => ['u', userId, 'jobs', 'detail', jobId] as const,
  },

  professionals: {
    all: (userId: Scope) => ['u', userId, 'professionals'] as const,
    profile: (userId: Scope, professionalId: string) => ['u', userId, 'professionals', 'profile', professionalId] as const,
    /** Prefix of every review list of a professional (all page sizes). */
    reviewsOf: (userId: Scope, professionalId: string) => ['u', userId, 'professionals', 'reviews', professionalId] as const,
    /** Pages differ by size, so the page size is part of the key (profile preview vs. full list). */
    reviews: (userId: Scope, professionalId: string, params: { limit: number }) =>
      ['u', userId, 'professionals', 'reviews', professionalId, params] as const,
    own: (userId: Scope) => ['u', userId, 'professionals', 'own'] as const,
  },

  customer: {
    profile: (userId: Scope) => ['u', userId, 'customer', 'profile'] as const,
  },

  notifications: {
    all: (userId: Scope) => ['u', userId, 'notifications'] as const,
    /** Prefix of every notification list (all filters). */
    lists: (userId: Scope) => ['u', userId, 'notifications', 'list'] as const,
    list: (userId: Scope, params: NotificationsParams = {}) => ['u', userId, 'notifications', 'list', params] as const,
    unreadCount: (userId: Scope) => ['u', userId, 'notifications', 'unread-count'] as const,
  },

  conversations: {
    /** Infinite list, most recent activity first. */
    list: (userId: Scope) => ['u', userId, 'conversations', 'list'] as const,
    /** Unread messages over all conversations (the inbox badge). */
    unreadCount: (userId: Scope) => ['u', userId, 'conversations', 'unread-count'] as const,
    /** Prefix of every conversation detail (not their messages). */
    details: (userId: Scope) => ['u', userId, 'conversations', 'detail'] as const,
    detail: (userId: Scope, conversationId: string) => ['u', userId, 'conversations', 'detail', conversationId] as const,
    messages: (userId: Scope, conversationId: string) =>
      ['u', userId, 'conversations', 'messages', conversationId] as const,
  },

  geo: {
    search: (query: string) => ['public', 'geo', 'search', query] as const,
    reverse: (latitude: number, longitude: number) => ['public', 'geo', 'reverse', latitude, longitude] as const,
  },
} as const;
