/**
 * Redis locks for cron (`SET key value NX PX ttl`):
 * - `claimOnce`: the first caller owns the key until it expires and it is never released, so a key
 *   named after a scheduled tick runs that tick once across instances, even on an instance whose
 *   timer fires late (clock skew, event-loop lag) after another one already finished it;
 * - `withRedisLock`: held while `work` runs and released by its owner (Lua compare and delete), so
 *   two runs of one job never overlap, whatever tick they belong to.
 */
import { randomToken } from '../../lib/crypto.js';
import type { Redis } from '../redis.js';

const RELEASE_SCRIPT = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;

/** True for the first caller of `key` within `ttlMs`. */
export async function claimOnce(redis: Redis, key: string, ttlMs: number): Promise<boolean> {
  return (await redis.set(key, '1', 'PX', ttlMs, 'NX')) === 'OK';
}

/** Runs `work` while holding `key`; returns `false` (without running it) when another holder has it. */
export async function withRedisLock(redis: Redis, key: string, ttlMs: number, work: () => Promise<void>): Promise<boolean> {
  const token = randomToken(16);
  if ((await redis.set(key, token, 'PX', ttlMs, 'NX')) !== 'OK') return false;
  try {
    await work();
  } finally {
    await redis.eval(RELEASE_SCRIPT, 1, key, token).catch(() => undefined);
  }
  return true;
}
