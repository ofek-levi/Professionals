/**
 * Session access for React.
 *
 * - `useSession()` reads the persisted session store (`services/auth/session-store`).
 * - `SessionProvider` starts the session lifecycle (cache reset and realtime connection on every
 *   identity change). Mount it once inside `QueryClientProvider`.
 * - `useAuthActions()` signs out.
 * - `establishSession()` is the single sign-in path: the email / Google auth mutations
 *   (`hooks/mutations/use-auth-mutations.ts`) all go through it.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useSyncExternalStore, type ReactNode } from 'react';

import { syncAccountLanguage } from '@/features/settings/account-language';
import { i18n, isSupportedLanguage } from '@/i18n';
import { api } from '@/services/api';
import { sessionStore, type SessionState } from '@/services/auth/session-store';
import { realtimeClient } from '@/services/realtime';
import type { AuthSession } from '@/types/api';

import { startSessionLifecycle } from './session-lifecycle';

/** Longest signing out waits for the server's logout (offline, slow network). */
const LOGOUT_TIMEOUT_MS = 5_000;

/** The current session: `{ status, userId, role }`. Re-renders on change. */
export function useSession(): SessionState {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.getState, sessionStore.getState);
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  useEffect(() => startSessionLifecycle({ store: sessionStore, queryClient, realtime: realtimeClient }), [queryClient]);

  return <>{children}</>;
}

interface AuthActions {
  /** Signs out (best-effort server logout, then local sign out). */
  signOut: () => Promise<void>;
}

/** `POST /auth/logout` with the session's refresh token, bounded in time; failures are ignored. */
async function logoutQuietly(): Promise<void> {
  const refreshToken = sessionStore.getTokens()?.refreshToken;
  if (!refreshToken) return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOGOUT_TIMEOUT_MS);
  try {
    await api.auth.logout({ refreshToken }, controller.signal);
  } catch {
    // The local session is cleared regardless (e.g. offline); the refresh token expires unused.
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Makes `session` the signed-in session. The session lifecycle clears the cache and connects
 * realtime synchronously here; the `Stack.Protected` guards then show the role's home. The
 * account's language follows the app's (it may have been changed while signed out).
 */
export async function establishSession(session: AuthSession): Promise<void> {
  await sessionStore.signIn(session);
  const language = i18n.language;
  if (isSupportedLanguage(language)) void syncAccountLanguage(language, session.user.preferredLanguage);
}

const authActions: AuthActions = {
  async signOut() {
    await logoutQuietly();
    await sessionStore.signOut();
  },
};

/** Stable auth actions (they only touch the API and the session store). */
export function useAuthActions(): AuthActions {
  return authActions;
}
