/**
 * The profile photo is saved on its own (`PUT` / `DELETE /me/avatar`), not with the profile form:
 * the answer (`CurrentUserResponse`) updates `/me` and the own profile at once.
 */
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/hooks/queries/query-keys';
import { useQueryScope } from '@/hooks/queries/query-scope';
import { api } from '@/services/api';
import type { CurrentUserResponse, CustomerProfileResponse, LocalImage } from '@/types/api';

import { invalidateOwnProfile } from './invalidation';

function writeOwnProfile(qc: QueryClient, userId: string | null, me: CurrentUserResponse): void {
  qc.setQueryData(queryKeys.auth.me(userId), me);
  if (me.customerProfile) qc.setQueryData<CustomerProfileResponse>(queryKeys.customer.profile(userId), { user: me.user, profile: me.customerProfile });
  if (me.professionalProfile) qc.setQueryData(queryKeys.professionals.own(userId), me.professionalProfile);
  // Lists and cards that show the avatar (public profile, dashboards) refetch.
  void invalidateOwnProfile(qc, userId);
}

/** `PUT /me/avatar` – sets or replaces the signed-in user's photo. */
export function useSetAvatar() {
  const qc = useQueryClient();
  const { userId } = useQueryScope();
  return useMutation({
    mutationFn: (image: LocalImage) => api.users.setAvatar(image),
    onSuccess: (me) => writeOwnProfile(qc, userId, me),
  });
}

/** `DELETE /me/avatar` – removes the signed-in user's photo. */
export function useRemoveAvatar() {
  const qc = useQueryClient();
  const { userId } = useQueryScope();
  return useMutation({
    mutationFn: () => api.users.removeAvatar(),
    onSuccess: (me) => writeOwnProfile(qc, userId, me),
  });
}
