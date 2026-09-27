/**
 * Mutation hooks. They invalidate/update the cache through `invalidation.ts` and the pure helpers
 * in `cache-updates.ts`; screens only call `mutate`/`mutateAsync` and render pending/error states.
 */
export {
  invalidateConversation,
  invalidateJobGraph,
  invalidateNotifications,
  invalidateOfferGraph,
  invalidateOwnProfile,
  invalidateProfessional,
  invalidateRequestGraph,
  type JobRef,
  type OfferRef,
} from './invalidation';
export { isPendingMessage } from './cache-updates';
export {
  useCancelRequest,
  useCreateRequest,
  useDeleteDraftRequest,
  usePublishRequest,
  useUpdateDraftRequest,
  type CancelRequestVariables,
  type UpdateDraftRequestVariables,
} from './use-request-mutations';
export { useUploadImage } from './use-upload-image';
export {
  useAcceptOffer,
  useCreateOffer,
  useUpdateOffer,
  useWithdrawOffer,
  type CreateOfferVariables,
  type UpdateOfferVariables,
} from './use-offer-mutations';
export { useCompleteJob, useConfirmJob, useCreateReview, useStartJob, type CreateReviewVariables } from './use-job-mutations';
export { useUpdateCustomerProfile, useUpdateProfessionalProfile } from './use-profile-mutations';
export { useMarkAllNotificationsAsRead, useMarkNotificationAsRead } from './use-notification-mutations';
export { useMarkConversationAsRead, useSendMessage, type SendMessageVariables } from './use-message-mutations';
