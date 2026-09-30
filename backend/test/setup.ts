/**
 * Runs in every test file: connects mongoose to this file's own database (indexes synced, the
 * database dropped afterwards) and opens a Redis connection whose keys are removed afterwards.
 */
import mongoose from 'mongoose';
import { afterAll, beforeAll } from 'vitest';

import '../src/models.js';
import { connectMongo, ensureIndexes } from '../src/infra/mongo.js';
import { closeRedis, createRedis } from '../src/infra/redis.js';
import { createSilentLogger } from '../src/lib/logger.js';
import { TEST_DB_NAME, TEST_MONGODB_URI, TEST_REDIS_PREFIX, TEST_REDIS_URL, testState } from './context.js';

async function deleteKeys(prefix: string): Promise<void> {
  const redis = testState.redis;
  if (!redis) return;
  let cursor = '0';
  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', `${prefix}:*`, 'COUNT', 500);
    if (keys.length > 0) await redis.del(...keys);
    cursor = next;
  } while (cursor !== '0');
}

// Opened at import time so `createTestApp()` also works while test files are being collected.
testState.redis = createRedis(TEST_REDIS_URL, 'api-test');

beforeAll(async () => {
  await connectMongo({ uri: TEST_MONGODB_URI, dbName: TEST_DB_NAME, maxPoolSize: 10 });
  await ensureIndexes(createSilentLogger());
});

afterAll(async () => {
  await mongoose.connection.db?.dropDatabase();
  await mongoose.disconnect();
  await deleteKeys(TEST_REDIS_PREFIX);
  if (testState.redis) await closeRedis(testState.redis);
  testState.redis = null;
});
