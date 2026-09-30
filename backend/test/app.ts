/**
 * App factory for tests: real MongoDB/Redis (this file's database and prefix), in-memory fakes
 * for every external provider, a controllable clock, rate limits and cron off by default.
 *
 *   const { app, deps } = createTestApp();
 *   await request(app).get('/v1/catalog/categories').expect(200);
 *   deps.mailer.sent / deps.push.sent / deps.realtime.eventsFor(userId) / deps.clock.advance(ms)
 */
import mongoose from 'mongoose';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';

import { createApp } from '../src/app.js';
import { parseEnv, type Env } from '../src/config/env.js';
import type { AppDeps } from '../src/deps.js';
import { createCache } from '../src/infra/cache.js';
import { CachedGeocoder, MemoryGeocoder } from '../src/infra/geo/index.js';
import { MemoryGoogleVerifier } from '../src/infra/google/index.js';
import { createRedisKeys } from '../src/infra/keys.js';
import { MemoryMailer } from '../src/infra/mail/index.js';
import { setModelClock } from '../src/infra/model-clock.js';
import { MemoryPasswordBreachChecker } from '../src/infra/password-breach/index.js';
import { MemoryPushSender } from '../src/infra/push/index.js';
import { MemoryRealtimePublisher } from '../src/infra/realtime/index.js';
import { MemoryImageStorage } from '../src/infra/storage/index.js';
import { BackgroundTasks } from '../src/lib/background.js';
import { FakeClock } from '../src/lib/clock.js';
import { API_LIMITS } from '../src/shared/limits.js';
import { createSilentLogger } from '../src/lib/logger.js';
import { TEST_MONGODB_URI, TEST_REDIS_PREFIX, TEST_REDIS_URL, testRedis } from './context.js';

export const TEST_JWT_SECRET = 'test-access-secret-with-at-least-32-characters';

export interface TestDeps extends AppDeps {
  clock: FakeClock;
  mailer: MemoryMailer;
  push: MemoryPushSender;
  storage: MemoryImageStorage;
  google: MemoryGoogleVerifier;
  passwordBreach: MemoryPasswordBreachChecker;
  realtime: MemoryRealtimePublisher;
  /** The provider behind `geocoder` (count calls to assert caching). */
  geocoderProvider: MemoryGeocoder;
}

export function testEnv(overrides: Record<string, string> = {}): Env {
  return parseEnv({
    APP_ENV: 'development',
    MONGODB_URI: TEST_MONGODB_URI,
    REDIS_URL: TEST_REDIS_URL,
    JWT_ACCESS_SECRET: TEST_JWT_SECRET,
    PUBLIC_API_URL: 'http://api.test',
    GOOGLE_WEB_CLIENT_ID: 'web-client.apps.googleusercontent.com',
    GOOGLE_IOS_CLIENT_ID: 'ios-client.apps.googleusercontent.com',
    RATE_LIMIT_ENABLED: 'false',
    CRON_ENABLED: 'false',
    // Every explorer event at once, so tests see them synchronously (coalescing has its own test).
    EXPLORER_EVENT_WINDOW_MS: '0',
    LOG_LEVEL: 'silent',
    ...overrides,
  });
}

export interface TestAppOptions {
  env?: Record<string, string>;
  /** Start time of the fake clock. */
  now?: string;
  /** Replace individual deps (e.g. a real `RedisRealtimePublisher`). */
  deps?: Partial<AppDeps>;
}

export function createTestDeps(options: TestAppOptions = {}): TestDeps {
  const env = testEnv(options.env);
  const logger = createSilentLogger();
  const redis = testRedis();
  const keys = createRedisKeys(TEST_REDIS_PREFIX);
  const cache = createCache(redis, keys, logger);
  const geocoderProvider = new MemoryGeocoder();
  const deps: TestDeps = {
    env,
    logger,
    clock: new FakeClock(options.now),
    redis,
    keys,
    cache,
    mailer: new MemoryMailer(),
    push: new MemoryPushSender(),
    storage: new MemoryImageStorage(),
    geocoder: new CachedGeocoder(geocoderProvider, { cache, redis, keys, minIntervalMs: 0, maxResults: API_LIMITS.geocoderMaxResults }),
    geocoderProvider,
    google: new MemoryGoogleVerifier(),
    passwordBreach: new MemoryPasswordBreachChecker(),
    realtime: new MemoryRealtimePublisher(),
    background: new BackgroundTasks(logger),
  };
  Object.assign(deps, options.deps);
  // Stored createdAt/updatedAt follow the fake clock too (also when no app is created).
  setModelClock(deps.clock);
  return deps;
}

/**
 * Holds each response until the background work it started (matching fan-out, push, stats) has
 * settled, so a test sees what a client sees a moment later instead of racing with it. Services
 * that must not wait for that work are tested on their own (`deps.background.size`).
 */
function settlingBackground(app: Express, background: BackgroundTasks): Express {
  const wrapper = express();
  wrapper.use((_req: Request, res: Response, next: NextFunction) => {
    const end = res.end.bind(res);
    res.end = ((...args: unknown[]) => {
      void background.drain().then(() => Reflect.apply(end, res, args));
      return res;
    }) as Response['end'];
    next();
  });
  wrapper.use(app);
  return wrapper;
}

export function createTestApp(options: TestAppOptions = {}): { app: Express; deps: TestDeps } {
  const deps = createTestDeps(options);
  return { app: settlingBackground(createApp(deps), deps.background), deps };
}

/** Deletes every document of every collection of this file's database (between tests). */
export async function clearDatabase(): Promise<void> {
  await Promise.all(Object.values(mongoose.models).map((model) => model.deleteMany({})));
}
