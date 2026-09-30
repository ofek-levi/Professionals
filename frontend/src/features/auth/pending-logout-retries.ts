/**
 * When a queued server sign-out (`services/auth/pending-logouts.ts`) is sent again: now (app
 * launch), after every sign-in, whenever the app returns to the foreground and, on the web, when
 * the browser reports it is back online.
 */
import { AppState } from 'react-native';

import type { PendingLogouts } from '@/services/auth/pending-logouts';
import type { SessionStore } from '@/services/auth/session-store';

interface PendingLogoutRetriesDeps {
  queue: Pick<PendingLogouts, 'flush'>;
  store: Pick<SessionStore, 'subscribe'>;
}

/** Starts the retries; returns a stop function. */
export function startPendingLogoutRetries({ queue, store }: PendingLogoutRetriesDeps): () => void {
  const flush = () => void queue.flush();
  flush();
  const appState = AppState.addEventListener('change', (status) => {
    if (status === 'active') flush();
  });
  const unsubscribe = store.subscribe((state) => {
    if (state.status === 'signedIn') flush();
  });
  const onlineTarget = typeof window !== 'undefined' && typeof window.addEventListener === 'function' ? window : null;
  onlineTarget?.addEventListener('online', flush);
  return () => {
    appState.remove();
    unsubscribe();
    onlineTarget?.removeEventListener('online', flush);
  };
}
