/** In-process pub/sub of the test double: realtime events per user and ended sessions. */
import type { RealtimeEvent } from '@/services/realtime/types';

import type { MockEventBus } from './types';

type Listener = (event: RealtimeEvent) => void;

export function createEventBus(): MockEventBus {
  const listeners = new Map<string, Set<Listener>>();
  const revocationListeners = new Set<(sessionId: string) => void>();
  return {
    subscribe(userId, listener) {
      const set = listeners.get(userId) ?? new Set<Listener>();
      set.add(listener);
      listeners.set(userId, set);
      return () => {
        set.delete(listener);
        if (set.size === 0) listeners.delete(userId);
      };
    },
    emit(userId, event) {
      listeners.get(userId)?.forEach((listener) => {
        try {
          listener(event);
        } catch {
          // A failing subscriber must never break the server.
        }
      });
    },
    onSessionRevoked(listener) {
      revocationListeners.add(listener);
      return () => {
        revocationListeners.delete(listener);
      };
    },
    revokeSession(sessionId) {
      revocationListeners.forEach((listener) => listener(sessionId));
    },
  };
}
