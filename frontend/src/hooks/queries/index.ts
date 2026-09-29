/**
 * Query hooks – the only way screens read server data. Every key comes from `queryKeys` and is
 * scoped by the signed-in user; hooks stay disabled while signed out, for the wrong role or when
 * a required id is missing.
 */
export { useCurrentUser, useDemoAccounts } from './use-auth-queries';
export { useCustomerDashboard, useProfessionalDashboard } from './use-dashboard-queries';
export { useCustomerRequests, useNearbyOpenRequests, useNearbyRequestsForMap, useRequest } from './use-request-queries';
export { useOffer, useProfessionalOffers, useRequestOffers, type OfferDetails } from './use-offer-queries';
export { useJob, useJobs } from './use-job-queries';
export { useOwnProfessionalProfile, useProfessionalProfile, useProfessionalReviews } from './use-professional-queries';
export { useCustomerProfile } from './use-customer-queries';
export { useNotifications, useUnreadNotificationsCount } from './use-notification-queries';
export { useConversation, useConversationMessages, useConversations } from './use-conversation-queries';
export { useRefetchOnFocus } from './use-refetch-on-focus';
export { useCategoryLookup } from './use-category-catalog';
