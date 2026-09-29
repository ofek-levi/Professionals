import { useQuery } from '@tanstack/react-query';

import { api } from '@/services/api';

import { queryKeys } from './query-keys';
import { useQueryScope } from './query-scope';

const DEMO_ACCOUNTS_STALE_TIME_MS = 5 * 60_000;
const CURRENT_USER_STALE_TIME_MS = 60_000;

/** `GET /auth/demo-accounts` – public, available while signed out. */
export function useDemoAccounts() {
  return useQuery({
    queryKey: queryKeys.auth.demoAccounts(),
    queryFn: () => api.auth.getDemoAccounts(),
    staleTime: DEMO_ACCOUNTS_STALE_TIME_MS,
  });
}

/** `GET /me` – the signed-in user with the role-specific profile (incl. notification preferences). */
export function useCurrentUser() {
  const { userId, enabled } = useQueryScope();
  return useQuery({
    queryKey: queryKeys.auth.me(userId),
    queryFn: () => api.auth.getCurrentUser(),
    enabled,
    staleTime: CURRENT_USER_STALE_TIME_MS,
  });
}
