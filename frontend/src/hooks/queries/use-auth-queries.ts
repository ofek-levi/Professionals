import { useQuery } from '@tanstack/react-query';

import { api } from '@/services/api';

import { queryKeys } from './query-keys';
import { useQueryScope } from './query-scope';

const CURRENT_USER_STALE_TIME_MS = 60_000;

/** `GET /me` – the signed-in user with the role-specific profile (incl. notification preferences). */
export function useCurrentUser() {
  const { userId, enabled } = useQueryScope();
  return useQuery({
    queryKey: queryKeys.auth.me(userId),
    queryFn: () => api.users.getCurrentUser(),
    enabled,
    staleTime: CURRENT_USER_STALE_TIME_MS,
  });
}
