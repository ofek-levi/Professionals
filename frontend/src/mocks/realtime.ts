/**
 * Realtime client backed by the mock server's event bus. Behaves like a WebSocket connection:
 * events arrive asynchronously, as serialized copies, only for the connected user.
 */
import type { RealtimeClient, RealtimeEvent, RealtimeListener } from '@/services/realtime/types';

import { parseAccessToken } from './server/auth';
import type { MockServer } from './server/types';

interface MockRealtimeOptions {
  /** Simulated delivery delay in ms (default 50). */
  deliveryDelayMs?: number;
}

export function createMockRealtimeClient(server: MockServer, options: MockRealtimeOptions = {}): RealtimeClient {
  const listeners = new Set<RealtimeListener>();
  const deliveryDelayMs = options.deliveryDelayMs ?? 50;
  let connectedToken: string | null = null;
  let unsubscribe: (() => void) | null = null;

  const deliver = (event: RealtimeEvent) => {
    const frame = JSON.stringify(event);
    setTimeout(() => {
      const copy = JSON.parse(frame) as RealtimeEvent;
      listeners.forEach((listener) => {
        try {
          listener(copy);
        } catch {
          // A failing listener must not affect the others.
        }
      });
    }, deliveryDelayMs);
  };

  const disconnect = () => {
    unsubscribe?.();
    unsubscribe = null;
    connectedToken = null;
  };

  return {
    connect(accessToken) {
      if (accessToken === connectedToken && unsubscribe) return;
      disconnect();
      const userId = parseAccessToken(accessToken);
      if (!userId) return;
      connectedToken = accessToken;
      unsubscribe = server.events.subscribe(userId, deliver);
    },
    disconnect,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
