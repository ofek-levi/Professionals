/**
 * Session access for React.
 *
 * - `useSession()` reads the persisted session store (`services/auth/session-store`).
 * - `SessionProvider` starts the session lifecycle (cache reset, realtime connection and push
 *   registration on every identity change). Mount it once inside `QueryClientProvider`.
 * - `useAuthActions()` signs in/out with demo accounts.
 * - `establishSession()` is the single sign-in path: demo accounts and the email / Google auth
 *   mutations (`hooks/mutations/use-auth-mutations.ts`) all go through it.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useSyncExternalStore, type ReactNode } from 'react';

import { api } from '@/services/api';
import { sessionStore, type SessionState } from '@/services/auth/session-store';
import { registerDeviceForPush } from '@/services/push';
import { realtimeClient } from '@/services/realtime';
import type { AuthSession } from '@/types/api';

import { startSessionLifecycle } from './session-lifecycle';

type Session = SessionState;

/** The current session: `{ status, userId, role, accessToken }`. Re-renders on change. */
export function useSession(): Session {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.getState, sessionStore.getState);
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  useEffect(
    () =>
      startSessionLifecycle({
        store: sessionStore,
        queryClient,
        realtime: realtimeClient,
        registerDevice: () => registerDeviceForPush(),
      }),
    [queryClient],
  );

  return <>{children}</>;
}

interface AuthActions {
  /** Signs in with a demo account (no password). Resolves with the new session. */
  signInWithDemoAccount: (userId: string) => Promise<AuthSession>;
  /** Signs out (best-effort server logout, then local sign out). "Switch account" is a sign-out. */
  signOut: () => Promise<void>;
}

async function logoutQuietly(): Promise<void> {
  if (!sessionStore.getAccessToken()) return;
  try {
    await api.auth.logout();
  } catch {
    // The local session is cleared regardless (e.g. offline).
  }
}

/**
 * Makes `session` the signed-in session. The session lifecycle clears the cache and reconnects
 * realtime synchronously here; the `Stack.Protected` guards then show the role's home.
 */
export async function establishSession(session: AuthSession): Promise<void> {
  await sessionStore.signIn(session.accessToken, session.user);
}

async function signInWithDemoAccount(userId: string): Promise<AuthSession> {
  const session = await api.auth.demoLogin({ userId });
  await establishSession(session);
  return session;
}

const authActions: AuthActions = {
  signInWithDemoAccount,
  async signOut() {
    await logoutQuietly();
    await sessionStore.signOut();
  },
};

/** Stable auth actions (they only touch the API and the session store). */
export function useAuthActions(): AuthActions {
  return authActions;
}
