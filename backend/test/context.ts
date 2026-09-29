/**
 * Per-test-file isolation. Every test file (vitest runs files in parallel worker processes, and
 * other agents run their suites at the same time) gets its own MongoDB database and its own Redis
 * key prefix; `setup.ts` creates and removes them. Never use a shared database name and never
 * FLUSHDB/FLUSHALL.
 */
import { randomBytes } from 'node:crypto';

import type { Redis } from '../src/infra/redis.js';

export const TEST_MONGODB_URI = process.env.TEST_MONGODB_URI ?? 'mongodb://127.0.0.1:27017/?replicaSet=rs0';
export const TEST_REDIS_URL = process.env.TEST_REDIS_URL ?? 'redis://127.0.0.1:6379';

const runId = `${process.pid}_${randomBytes(4).toString('hex')}`;

/** Unique database of this test file. */
export const TEST_DB_NAME = `pro_test_${runId}`;
/** Unique Redis prefix of this test file; still starts with the APP_ENV used by tests. */
export const TEST_REDIS_PREFIX = `development:test_${runId}`;

interface TestState {
  redis: Redis | null;
}

export const testState: TestState = { redis: null };

/** The Redis connection of this test file (opened in `setup.ts`). */
export function testRedis(): Redis {
  if (!testState.redis) throw new Error('Test Redis is not connected (test/setup.ts did not run)');
  return testState.redis;
}
