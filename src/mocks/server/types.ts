/**
 * Public contract of the in-app mock backend. The UI never imports anything from `src/mocks`
 * directly – only `services/api` (transport) and `services/realtime` (event bus) do.
 */
import type { TransportRequest, TransportResponse } from '@/services/api/transport';
import type { RealtimeEvent } from '@/services/realtime/types';

export interface MockServerOptions {
  /** Clock used for all timestamps (injectable for deterministic tests). */
  now?: () => Date;
  /** Persist the database with AsyncStorage (disabled in tests). */
  persist?: boolean;
  /** Enable the demo simulator (auto offers from other professionals, etc.). */
  simulation?: boolean;
  /** Timer used by the simulator; tests can pass a synchronous fake. */
  schedule?: (callback: () => void, delayMs: number) => void;
}

export interface MockEventBus {
  /** Subscribe to events addressed to `userId`. Returns an unsubscribe function. */
  subscribe(userId: string, listener: (event: RealtimeEvent) => void): () => void;
  emit(userId: string, event: RealtimeEvent): void;
}

export interface MockServer {
  /** Resolves once the database has been loaded (from storage or seed). */
  ready(): Promise<void>;
  /** Handles one HTTP-like request exactly like a REST backend would. */
  handle(request: TransportRequest): Promise<TransportResponse>;
  events: MockEventBus;
  /** Re-seeds the database with fresh demo data. */
  reset(): Promise<void>;
  setSimulationEnabled(enabled: boolean): void;
  isSimulationEnabled(): boolean;
}
