/**
 * Fixed-window counters on Redis for limits outside express-rate-limit (WebSocket upgrades, failed
 * sign-ins, geocoder misses, image bytes per day): `INCRBY` and, on the window's first hit, `PEXPIRE`,
 * atomically in one script so a key can never be left without a TTL.
 */
import type { Redis } from './redis.js';

const HIT_SCRIPT = `local n = redis.call("INCRBY", KEYS[1], ARGV[2]) if n == tonumber(ARGV[2]) then redis.call("PEXPIRE", KEYS[1], ARGV[1]) end return n`;

/** Adds `amount` to the window of `key`; returns the window's new total. */
export async function hitFixedWindow(redis: Redis, key: string, windowMs: number, amount = 1): Promise<number> {
  const total = await redis.eval(HIT_SCRIPT, 1, key, windowMs, amount);
  return typeof total === 'number' ? total : Number(total);
}

/** Counts one hit on `key`; true while the window holds at most `limit` hits. */
export async function withinFixedWindow(redis: Redis, key: string, limit: number, windowMs: number): Promise<boolean> {
  return (await hitFixedWindow(redis, key, windowMs)) <= limit;
}

/** Current total of the window of `key` (0 when it has not started or has ended). */
export async function fixedWindowTotal(redis: Redis, key: string): Promise<number> {
  return Number((await redis.get(key)) ?? 0);
}
