/**
 * Test harness of the backend test double: a server with a controllable clock, the transport the
 * app's `ApiClient` uses in tests (with a request log), the realtime socket server, and typed API
 * clients (the real endpoint modules) acting as seeded users.
 */
import { ApiClient } from '@/services/api/client';
import { ApiError } from '@/services/api/errors';
import { createMarketplaceApi, type MarketplaceApi } from '@/services/api/marketplace-api';
import type { Transport } from '@/services/api/transport';
import type { AuthSession } from '@/types/api';

import { createMockServer, type InternalMockServer } from '../server';
import { sessionIdOfToken } from '../server/sessions';
import { toUser } from '../server/views';
import { createMockSocketServer, type MockSocketServer } from '../socket-server';
import { createMockTransport, type TransportLog } from '../transport';

/** Sunday 27 Sep 2026, 07:00 UTC. */
export const TEST_NOW = new Date('2026-09-27T07:00:00.000Z');

export interface TestClock {
  now(): Date;
  set(date: Date | string): void;
  advanceMinutes(minutes: number): void;
  advanceHours(hours: number): void;
}

export function createTestClock(start: Date = TEST_NOW): TestClock {
  let current = new Date(start.getTime());
  return {
    now: () => new Date(current.getTime()),
    set: (date) => {
      current = new Date(date);
    },
    advanceMinutes: (minutes) => {
      current = new Date(current.getTime() + minutes * 60_000);
    },
    advanceHours: (hours) => {
      current = new Date(current.getTime() + hours * 3_600_000);
    },
  };
}

export interface TestEnvironment {
  server: InternalMockServer;
  clock: TestClock;
  /** For `apiClient.setTransport()` / `new ApiClient({ transport })`. */
  transport: Transport;
  /** Every request sent through `transport`. */
  log: TransportLog;
  /** The realtime endpoint (`openSocket` for the app's WebSocket client). */
  sockets: MockSocketServer;
  /** Typed API client acting as `userId` (`null` = anonymous). */
  as(userId: string | null): MarketplaceApi;
  /** A valid access token of `userId` (one harness session per user, re-issued when expired). */
  accessTokenFor(userId: string): string;
  /** A new session of `userId`, as `POST /auth/login` answers it (for `sessionStore.signIn`). */
  signIn(userId: string): AuthSession;
}

/**
 * `now` is the server clock's start (default `TEST_NOW`). Tests that run the app's own token
 * manager (which reads the device clock) pass `new Date()` so both clocks agree on token expiry.
 */
export function createTestEnvironment(options: { now?: Date } = {}): TestEnvironment {
  const clock = createTestClock(options.now);
  const server = createMockServer({ now: clock.now });
  const { transport, log } = createMockTransport(server);
  const harnessSessions = new Map<string, string>();

  const signIn = (userId: string): AuthSession => ({
    ...server.internals.startSession(userId),
    user: toUser(server.internals.db.users.require(userId, 'User')),
  });

  // An unknown user id still gets a (useless) session: its requests answer 401 like a stale token.
  const accessTokenFor = (userId: string): string => {
    const sessionId = harnessSessions.get(userId);
    const token = sessionId ? server.internals.issueAccessToken(sessionId) : null;
    if (token) return token;
    const tokens = server.internals.startSession(userId);
    harnessSessions.set(userId, sessionIdOfToken(tokens.accessToken) ?? '');
    return tokens.accessToken;
  };

  return {
    server,
    clock,
    transport,
    log,
    sockets: createMockSocketServer(server),
    as(userId) {
      return createMarketplaceApi(
        new ApiClient({ transport, auth: { getAccessToken: () => (userId ? accessTokenFor(userId) : null) } }),
      );
    },
    accessTokenFor,
    signIn,
  };
}

/** Awaits a promise that must reject with an `ApiError` and returns it. */
export async function expectApiError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('Expected the request to fail with an ApiError');
}

/** ISO instant `minutes` after the environment's current clock. */
export function minutesFromNow(env: Pick<TestEnvironment, 'clock'>, minutes: number): string {
  return new Date(env.clock.now().getTime() + minutes * 60_000).toISOString();
}
