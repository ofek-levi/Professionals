/**
 * Every React Query key used in the app is created here, so cache reads, writes and
 * invalidations always agree. Keys are hierarchical: invalidating `queryKeys.requests.all`
 * invalidates every request related query.
 *
 * All keys are scoped by the signed-in user id (first element) so switching demo accounts can
 * never show another user's cached data.
 */
import type {
  CustomerRequestsParams,
  JobScope,
  NearbyRequestsParams,
  NotificationsParams,
  ProfessionalOffersParams,
  RequestOffersParams,
  SearchProfessionalsParams,
} from '@/types/api';

type Scope = string | null;

export const queryKeys = {
  /** Root key for everything belonging to one signed-in user. */
  user: (userId: Scope) => ['u', userId] as const,

  auth: {
    demoAccounts: () => ['public', 'demo-accounts'] as const,
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
    all: (userId: Scope) => ['u', userId, 'requests'] as const,
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
    all: (userId: Scope) => ['u', userId, 'offers'] as const,
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
    list: (userId: Scope, scope: JobScope) => ['u', userId, 'jobs', 'list', scope] as const,
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
    /** Prefix of every professional search. */
    searches: (userId: Scope) => ['u', userId, 'professionals', 'search'] as const,
    search: (userId: Scope, params: SearchProfessionalsParams) => ['u', userId, 'professionals', 'search', params] as const,
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
    all: (userId: Scope) => ['u', userId, 'conversations'] as const,
    list: (userId: Scope) => ['u', userId, 'conversations', 'list'] as const,
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
