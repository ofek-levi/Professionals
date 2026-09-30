/**
 * Public contract of the backend test double (tests only; ESLint keeps it out of the app).
 */
import type { TransportRequest, TransportResponse } from '@/services/api/transport';
import type { RealtimeEvent } from '@/services/realtime/types';

export interface MockServerOptions {
  /** Clock used for all timestamps and token expiries (injectable for deterministic tests). */
  now?: () => Date;
}

export interface MockEventBus {
  /** Subscribe to events addressed to `userId`. Returns an unsubscribe function. */
  subscribe(userId: string, listener: (event: RealtimeEvent) => void): () => void;
  emit(userId: string, event: RealtimeEvent): void;
  /** Called when a session ends (sign-out, refresh-token reuse). Returns an unsubscribe function. */
  onSessionRevoked(listener: (sessionId: string) => void): () => void;
  revokeSession(sessionId: string): void;
}

export interface MockServer {
  /** Handles one HTTP-like request exactly like the REST backend would. */
  handle(request: TransportRequest): Promise<TransportResponse>;
  events: MockEventBus;
}
