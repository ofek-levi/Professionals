/**
 * Test harness for the mock backend: a server with a controllable clock, no persistence and a
 * manual scheduler, plus typed API clients (the real endpoint modules) authenticated per user.
 */
import { ApiClient } from '@/services/api/client';
import { ApiError } from '@/services/api/errors';
import { createMarketplaceApi, type MarketplaceApi } from '@/services/api/marketplace-api';

import { createAccessToken } from '../server/auth';
import { createMockServer, type InternalMockServer } from '../server';
import { createMockTransport } from '../transport';

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

export interface ScheduledTask {
  delayMs: number;
  callback: () => void;
}

export interface TestEnvironment {
  server: InternalMockServer;
  clock: TestClock;
  /** Typed API client acting as `userId` (`null` = anonymous). */
  as(userId: string | null): MarketplaceApi;
  /** Tasks registered by the simulator (never run automatically). */
  scheduled: ScheduledTask[];
  /** Runs (and removes) every scheduled task, in delay order. */
  runScheduled(): void;
}

export async function createTestEnvironment(
  options: { now?: Date; simulation?: boolean } = {},
): Promise<TestEnvironment> {
  const clock = createTestClock(options.now);
  const scheduled: ScheduledTask[] = [];
  const server = createMockServer({
    now: clock.now,
    persist: false,
    simulation: options.simulation ?? false,
    schedule: (callback, delayMs) => scheduled.push({ callback, delayMs }),
  });
  await server.ready();
  const { transport } = createMockTransport(server, { minLatencyMs: 0, maxLatencyMs: 0, failureRate: 0 });
  return {
    server,
    clock,
    scheduled,
    as(userId) {
      const token = userId ? createAccessToken(userId) : null;
      return createMarketplaceApi(new ApiClient({ transport, getAccessToken: () => token }));
    },
    runScheduled() {
      const tasks = scheduled.splice(0).sort((a, b) => a.delayMs - b.delayMs);
      tasks.forEach((task) => task.callback());
    },
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
