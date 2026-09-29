/**
 * Dependencies injected into the app, services and cron jobs. Services receive `deps` (or the
 * subset they need) instead of importing providers, so tests swap in fakes (`test/app.ts`).
 * MongoDB is the process-wide mongoose connection and is not part of deps.
 */
import type { Env } from './config/env.js';
import { createCache, type Cache } from './infra/cache.js';
import { CachedGeocoder, NominatimGeocoder, type Geocoder } from './infra/geo/index.js';
import { createGoogleVerifier, type GoogleVerifier } from './infra/google/index.js';
import { createRedisKeys, KEY_SPACES, type RedisKeys } from './infra/keys.js';
import { createMailer, type Mailer } from './infra/mail/index.js';
import { createPasswordBreachChecker, type PasswordBreachChecker } from './infra/password-breach/index.js';
import { ExpoPushSender, type PushSender } from './infra/push/index.js';
import { RedisRealtimePublisher, type RealtimePublisher } from './infra/realtime/index.js';
import type { Redis } from './infra/redis.js';
import { createImageStorage, type ImageStorage } from './infra/storage/index.js';
import { BackgroundTasks } from './lib/background.js';
import { systemClock, type Clock } from './lib/clock.js';
import type { Logger } from './lib/logger.js';

export interface AppDeps {
  env: Env;
  logger: Logger;
  clock: Clock;
  /** Command connection (cache, locks, rate limits, pub/sub publish). */
  redis: Redis;
  /** `${APP_ENV}:`-prefixed key builder; the only way to name Redis keys. */
  keys: RedisKeys;
  cache: Cache;
  mailer: Mailer;
  push: PushSender;
  storage: ImageStorage;
  geocoder: Geocoder;
  google: GoogleVerifier;
  passwordBreach: PasswordBreachChecker;
  realtime: RealtimePublisher;
  background: BackgroundTasks;
}

/** Production wiring of the real providers. */
export function createDeps({ env, logger, redis }: { env: Env; logger: Logger; redis: Redis }): AppDeps {
  const keys = createRedisKeys(env.appEnv);
  const cache = createCache(redis, keys, logger);
  return {
    env,
    logger,
    clock: systemClock,
    redis,
    keys,
    cache,
    mailer: createMailer(env, logger),
    push: new ExpoPushSender(env.expoAccessToken),
    storage: createImageStorage(env),
    geocoder: new CachedGeocoder(new NominatimGeocoder(env.geocoder), { cache, redis, keys, minIntervalMs: 1000 }),
    google: createGoogleVerifier(env),
    passwordBreach: createPasswordBreachChecker(env, logger),
    realtime: new RedisRealtimePublisher(redis, keys.key(KEY_SPACES.realtimeChannel), logger),
    background: new BackgroundTasks(logger),
  };
}
