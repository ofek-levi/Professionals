/**
 * The app-wide React Query client and its defaults.
 *
 * - Queries retry at most twice, and only for transient failures (`ApiError.isRetryable`:
 *   network errors, timeouts, rate limiting, 5xx). Validation/permission errors fail fast.
 * - Mutations never retry automatically (they are not guaranteed to be idempotent).
 * - On native, "window focus" is mapped to the app returning to the foreground so stale data
 *   refreshes when the user comes back to the app.
 */
import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform, type AppStateStatus } from 'react-native';

import { toApiError } from '@/services/api/errors';

export const QUERY_STALE_TIME_MS = 30_000;
export const QUERY_GC_TIME_MS = 10 * 60_000;
/** Maximum number of automatic retries for a failed query. */
export const MAX_QUERY_RETRIES = 2;

/** Retry policy for queries: transient errors only, at most `MAX_QUERY_RETRIES` times. */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  return failureCount < MAX_QUERY_RETRIES && toApiError(error).isRetryable;
}

/** Exponential backoff capped at 8 s (0.8 s, 1.6 s, …). */
export function retryDelay(attemptIndex: number): number {
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
