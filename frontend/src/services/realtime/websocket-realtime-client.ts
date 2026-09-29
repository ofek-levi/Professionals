import type { RealtimeClient, RealtimeEvent, RealtimeListener } from './types';

/**
 * Production realtime client skeleton (WebSocket). Not used while `EXPO_PUBLIC_API_MODE=mock`.
 * Expects the backend to send JSON-encoded `RealtimeEvent` frames.
 */
export function createWebSocketRealtimeClient(url: string): RealtimeClient {
  const listeners = new Set<RealtimeListener>();
  let socket: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let currentToken: string | null = null;

  const open = () => {
    if (!currentToken) return;
    socket = new WebSocket(`${url}?token=${encodeURIComponent(currentToken)}`);
    socket.onmessage = (message) => {
      try {
        const event = JSON.parse(String(message.data)) as RealtimeEvent;
        listeners.forEach((listener) => listener(event));
      } catch {
        // Ignore malformed frames.
      }
    };
    socket.onclose = () => {
      socket = null;
      if (currentToken) reconnectTimer = setTimeout(open, 3_000);
    };
  };

  return {
    connect(accessToken) {
      if (currentToken === accessToken && socket) return;
      currentToken = accessToken;
      socket?.close();
      open();
    },
    disconnect() {
      currentToken = null;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
      socket = null;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
