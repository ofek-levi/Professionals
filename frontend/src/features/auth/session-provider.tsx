/**
 * Session access for React.
 *
 * - `useSession()` reads the persisted session store (`services/auth/session-store`).
 * - `SessionProvider` starts the session lifecycle (cache reset and realtime connection on every
 *   identity change). Mount it once inside `QueryClientProvider`.
 * - `useAuthActions()` signs out: realtime closed first, the session ended locally at once, then
 *   the server logout, queued until the server confirms it (`pendingLogouts`).
 * - `establishSession()` is the single sign-in path: the email / Google auth mutations
 *   (`hooks/mutations/use-auth-mutations.ts`) all go through it.
 * - `deleteAccountAndSignOut()` deletes the account (`POST /me/deletion`) and signs out on this
 *   device only: the server already ended every session.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useSyncExternalStore, type ReactNode } from 'react';

import { syncAccountLanguage } from '@/features/settings/account-language';
import { i18n, isSupportedLanguage } from '@/i18n';
import { api } from '@/services/api';
import { createPendingLogouts } from '@/services/auth/pending-logouts';
import { sessionStore, type SessionState } from '@/services/auth/session-store';
import { realtimeClient } from '@/services/realtime';
import type { AuthSession, DeleteAccountRequest } from '@/types/api';

import { startPendingLogoutRetries } from './pending-logout-retries';
import { startSessionLifecycle } from './session-lifecycle';

/** Server sign-outs not confirmed yet (offline, slow server), sent again until they are. */
export const pendingLogouts = createPendingLogouts({ logout: (refreshToken) => api.auth.logout({ refreshToken }) });

/** The current session: `{ status, userId, role }`. Re-renders on change. */
export function useSession(): SessionState {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.getState, sessionStore.getState);
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  useEffect(() => startSessionLifecycle({ store: sessionStore, queryClient, realtime: realtimeClient }), [queryClient]);
  useEffect(() => startPendingLogoutRetries({ queue: pendingLogouts, store: sessionStore }), []);

  return <>{children}</>;
}

interface AuthActions {
  /**
   * Signs out on this device at once (resolves then) and ends the session on the server in the
   * background (`POST /auth/logout`, retried later when it fails).
   */
  signOut: () => Promise<void>;
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

/**
 * `POST /me/deletion`, then signs out here without a server logout: the deletion ended every
 * session of the account. Realtime is closed first, as for a sign-out (the server closes the
 * account's sockets with 4001, which the realtime client would answer with a refresh that fails
 * and reports "You've been signed out"), and reconnected when the deletion was refused.
 */
export async function deleteAccountAndSignOut(proof: DeleteAccountRequest): Promise<void> {
  realtimeClient.disconnect();
  try {
    await api.users.deleteAccount(proof);
  } catch (error) {
    if (sessionStore.getState().status === 'signedIn') realtimeClient.connect();
    throw error;
  }
  await sessionStore.signOut();
}

const authActions: AuthActions = {
  async signOut() {
    // Closed first: ending the session, the server closes its sockets (4001), which the realtime
    // client would otherwise take for an expired token and answer with a refresh of the refresh
    // token just revoked.
    realtimeClient.disconnect();
    const refreshToken = sessionStore.getTokens()?.refreshToken;
    // Queued (persisted) before the local sign-out, so the server logout survives the app being
    // closed right after.
    if (refreshToken) await pendingLogouts.add(refreshToken);
    try {
      await sessionStore.signOut();
    } catch (error) {
      // Still signed in (the local sign-out failed): keep the session and its live updates.
      if (refreshToken) await pendingLogouts.discard(refreshToken);
      if (sessionStore.getState().status === 'signedIn') realtimeClient.connect();
      throw error;
    }
    void pendingLogouts.flush();
  },
};

/** Stable auth actions (they only touch the API and the session store). */
export function useAuthActions(): AuthActions {
  return authActions;
}
