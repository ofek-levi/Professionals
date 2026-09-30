/**
 * Side effects of identity changes, driven directly by the session store.
 *
 * Runs synchronously inside the store's `setState` – i.e. before React re-renders with the new
 * identity – so the query cache is cleared before any screen can observe it with another user.
 * It covers every path that changes the identity: sign in, sign out, switching accounts, restoring
 * a persisted session at launch, another tab (web) and a failed token refresh (session over).
 * Token refreshes keep the identity: they neither clear the cache nor reconnect realtime.
 */
import type { QueryClient } from '@tanstack/react-query';

import type { SessionState, SessionStore } from '@/services/auth/session-store';
import type { RealtimeClient } from '@/services/realtime/types';

interface SessionLifecycleDeps {
  store: Pick<SessionStore, 'getState' | 'subscribe'>;
  queryClient: Pick<QueryClient, 'clear'>;
  realtime: Pick<RealtimeClient, 'connect' | 'disconnect'>;
}

function identityOf(state: SessionState): string | null {
  return state.status === 'signedIn' ? state.userId : null;
}

/** Starts reacting to identity changes; returns a stop function (also disconnects realtime). */
export function startSessionLifecycle({ store, queryClient, realtime }: SessionLifecycleDeps): () => void {
  // `undefined` until the first resolved (non-loading) state has been seen.
  let current: string | null | undefined;

  const handle = (state: SessionState) => {
    if (state.status === 'loading') return;
    const next = identityOf(state);
    if (current !== undefined && current === next) return;

    const isInitial = current === undefined;
    current = next;
    // Never let one identity see another one's cached data (the cache is empty on first run).
    if (!isInitial) queryClient.clear();

    realtime.disconnect();
    if (next) realtime.connect();
  };

  handle(store.getState());
  const unsubscribe = store.subscribe(handle);
  return () => {
    unsubscribe();
    realtime.disconnect();
  };
}
