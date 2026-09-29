/**
 * Side effects of identity changes, driven directly by the session store.
 *
 * Runs synchronously inside the store's `setState` – i.e. before React re-renders with the new
 * identity – so the query cache is cleared before any screen can observe it with another user.
 * It covers every path that changes the identity: sign in, sign out, switching accounts, restoring
 * a persisted session at launch and the API client's 401 handling.
 */
import type { QueryClient } from '@tanstack/react-query';

import type { SessionState, sessionStore as SessionStoreInstance } from '@/services/auth/session-store';
import type { RealtimeClient } from '@/services/realtime/types';

interface SessionLifecycleDeps {
  store: Pick<typeof SessionStoreInstance, 'getState' | 'subscribe'>;
  queryClient: Pick<QueryClient, 'clear'>;
  realtime: Pick<RealtimeClient, 'connect' | 'disconnect'>;
  /** Registers the device for push notifications for the new identity. */
  registerDevice: () => Promise<unknown>;
}

interface Identity {
  userId: string | null;
  accessToken: string | null;
}

function identityOf(state: SessionState): Identity {
  return state.status === 'signedIn'
    ? { userId: state.userId, accessToken: state.accessToken }
    : { userId: null, accessToken: null };
}

/** Starts reacting to identity changes; returns a stop function (also disconnects realtime). */
export function startSessionLifecycle({ store, queryClient, realtime, registerDevice }: SessionLifecycleDeps): () => void {
  // `undefined` until the first resolved (non-loading) state has been seen.
  let current: Identity | undefined;

  const handle = (state: SessionState) => {
    if (state.status === 'loading') return;
    const next = identityOf(state);
    if (current && current.userId === next.userId && current.accessToken === next.accessToken) return;

    const isInitial = current === undefined;
    current = next;
    // Never let one identity see another one's cached data (the cache is empty on first run).
    if (!isInitial) queryClient.clear();

    if (next.userId && next.accessToken) {
      realtime.connect(next.accessToken);
      void registerDevice();
    } else {
      realtime.disconnect();
    }
  };

  handle(store.getState());
  const unsubscribe = store.subscribe(handle);
  return () => {
    unsubscribe();
    realtime.disconnect();
  };
}
