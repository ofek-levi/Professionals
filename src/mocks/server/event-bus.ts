/** In-process pub/sub used by the mock backend to push realtime events to users. */
import type { RealtimeEvent } from '@/services/realtime/types';

import type { MockEventBus } from './types';

type Listener = (event: RealtimeEvent) => void;

export function createEventBus(): MockEventBus {
  const listeners = new Map<string, Set<Listener>>();
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
  };
}
