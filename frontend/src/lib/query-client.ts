/**
 * The app-wide React Query client and its defaults.
 *
 * - Queries retry at most twice, and only for transient failures (`ApiError.isRetryable`:
 *   network errors, timeouts, 5xx). Validation/permission errors fail fast. A rate-limited query
 *   (429) retries only when the server's `Retry-After` is short, and waits that long; otherwise
 *   retrying at once would be refused again (and count against the limit).
 * - Mutations never retry automatically (they are not guaranteed to be idempotent).
 * - On native, "window focus" is mapped to the app returning to the foreground so stale data
 *   refreshes when the user comes back to the app.
 */
import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform, type AppStateStatus } from 'react-native';

import { toApiError } from '@/services/api/errors';

const QUERY_STALE_TIME_MS = 30_000;
const QUERY_GC_TIME_MS = 10 * 60_000;
/** Maximum number of automatic retries for a failed query. */
export const MAX_QUERY_RETRIES = 2;

/** A 429 is retried automatically only when the server frees up within this (`Retry-After`). */
const MAX_RATE_LIMIT_WAIT_S = 10;

/** Retry policy for queries: transient errors only, at most `MAX_QUERY_RETRIES` times. */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  const apiError = toApiError(error);
  if (failureCount >= MAX_QUERY_RETRIES || !apiError.isRetryable) return false;
  if (apiError.code === 'RATE_LIMITED') return apiError.retryAfterSeconds !== null && apiError.retryAfterSeconds <= MAX_RATE_LIMIT_WAIT_S;
  return true;
}

/** Exponential backoff capped at 8 s (0.8 s, 1.6 s, …); a 429 waits its `Retry-After`. */
export function retryDelay(attemptIndex: number, error?: unknown): number {
  const apiError = error === undefined ? null : toApiError(error);
  if (apiError?.code === 'RATE_LIMITED' && apiError.retryAfterSeconds !== null) return Math.max(1, apiError.retryAfterSeconds) * 1000;
  return Math.min(800 * 2 ** attemptIndex, 8_000);
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: QUERY_STALE_TIME_MS,
        gcTime: QUERY_GC_TIME_MS,
        retry: shouldRetryQuery,
        retryDelay,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/** Singleton used by the app (tests create their own with `createQueryClient`). */
export const queryClient = createQueryClient();

/**
 * Wires React Query's focus manager to `AppState` on iOS/Android (the web uses the default
 * `visibilitychange` listener). Returns a cleanup function.
 */
export function bindQueryFocusToAppState(): () => void {
  if (Platform.OS === 'web') return () => undefined;
  focusManager.setEventListener((handleFocus) => {
    const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
      handleFocus(status === 'active');
    });
    return () => subscription.remove();
  });
  // Replacing the listener runs the previous cleanup, which removes the AppState subscription.
  return () => focusManager.setEventListener(() => undefined);
}
