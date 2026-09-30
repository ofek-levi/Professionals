/**
 * Mutation hooks. They invalidate/update the cache through `invalidation.ts` and the pure helpers
 * in `cache-updates.ts`; screens only call `mutate`/`mutateAsync` and render pending/error states.
 */
export { isPendingMessage } from './cache-updates';
export { useGoogleAuth, useLogin, useRegister, useRequestPasswordReset, useResendVerificationEmail } from './use-auth-mutations';
export { useCancelRequest, useCreateRequest, useDeleteDraftRequest, usePublishRequest, useUpdateDraftRequest } from './use-request-mutations';
export { useAcceptOffer, useCreateOffer, useUpdateOffer, useWithdrawOffer } from './use-offer-mutations';
export { useCompleteJob, useConfirmJob, useCreateReview, useStartJob } from './use-job-mutations';
export { useRemoveAvatar, useSetAvatar } from './use-avatar-mutations';
export { useUpdateCustomerProfile, useUpdateProfessionalProfile } from './use-profile-mutations';
export { useMarkAllNotificationsAsRead } from './use-notification-mutations';
export { useMarkConversationAsRead, useSendMessage } from './use-message-mutations';
