/**
 * Query hooks – the only way screens read server data. Every key comes from `queryKeys` and is
 * scoped by the signed-in user; hooks stay disabled while signed out, for the wrong role or when
 * a required id is missing.
 */
export { queryKeys } from './query-keys';
export {
  DEFAULT_PAGE_SIZE,
  selectPaginatedList,
  useQueryScope,
  type PageParam,
  type PaginatedInfiniteData,
  type PaginatedList,
  type QueryScope,
} from './query-scope';
export { useCurrentUser, useDemoAccounts } from './use-auth-queries';
export { useCustomerDashboard, useProfessionalDashboard } from './use-dashboard-queries';
export {
  NEARBY_MAP_LIMIT,
  useCustomerRequests,
  useNearbyOpenRequests,
  useNearbyRequestsForMap,
  useRequest,
  type CustomerRequestsQueryParams,
  type NearbyRequestsQueryParams,
} from './use-request-queries';
export {
  useOffer,
  useProfessionalOffers,
  useRequestOffers,
  type OfferDetails,
  type ProfessionalOffersQueryParams,
} from './use-offer-queries';
export { useJob, useJobs } from './use-job-queries';
export {
  useOwnProfessionalProfile,
  useProfessionalProfile,
  useProfessionalReviews,
  useSearchProfessionals,
  type ReviewsList,
  type ReviewsPage,
} from './use-professional-queries';
export { useCustomerProfile } from './use-customer-queries';
export { useNotifications, useUnreadNotificationsCount, type NotificationsQueryParams } from './use-notification-queries';
export {
  MESSAGES_PAGE_SIZE,
  useConversation,
  useConversationMessages,
  useConversations,
} from './use-conversation-queries';
export { useRefetchOnFocus } from './use-refetch-on-focus';
export { createCategoryLookup, useCategoryCatalog, useCategoryLookup, type CategoryLookup } from './use-category-catalog';
export { usePlaceSearch, useReverseGeocode, type UsePlaceSearchOptions } from './use-geo';
