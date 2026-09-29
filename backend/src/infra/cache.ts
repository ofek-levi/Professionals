/**
 * JSON cache on Redis. Only for data that is safe to serve stale for the TTL or that is
 * invalidated precisely on write (see docs/CONVENTIONS.md → Caching). Cache failures never fail
 * the request: reads fall back to the loader.
 */
import type { Logger } from '../lib/logger.js';
import { KEY_SPACES, type RedisKeys } from './keys.js';
import type { Redis } from './redis.js';

export interface Cache {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  del(...keys: string[]): Promise<void>;
  /** Cached value or `load()` (stored for `ttlSeconds`). `null` results are not cached. */
  wrap<T>(key: string, ttlSeconds: number, load: () => Promise<T | null>): Promise<T | null>;
}

export function createCache(redis: Redis, keys: RedisKeys, logger: Logger): Cache {
  const full = (key: string) => keys.key(KEY_SPACES.cache, key);
  const cache: Cache = {
    async get<T>(key: string) {
      try {
        const raw = await redis.get(full(key));
        return raw === null ? null : (JSON.parse(raw) as T);
      } catch (error) {
        logger.warn({ err: error, key }, 'cache read failed');
        return null;
      }
    },
    async set(key, value, ttlSeconds) {
      try {
        await redis.set(full(key), JSON.stringify(value), 'EX', ttlSeconds);
      } catch (error) {
        logger.warn({ err: error, key }, 'cache write failed');
      }
    },
    async del(...list) {
      if (list.length === 0) return;
      try {
        await redis.del(...list.map(full));
      } catch (error) {
        logger.warn({ err: error, keys: list }, 'cache delete failed');
      }
    },
    async wrap<T>(key: string, ttlSeconds: number, load: () => Promise<T | null>) {
      const hit = await cache.get<T>(key);
      if (hit !== null) return hit;
      const value = await load();
      if (value !== null) await cache.set(key, value, ttlSeconds);
      return value;
    },
  };
  return cache;
}
