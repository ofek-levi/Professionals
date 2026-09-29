/**
 * Distributed lock on Redis (`SET key token NX PX ttl`), released only by its owner (Lua compare
 * and delete). Cron jobs take it so that one instance runs each tick.
 */
import { randomToken } from '../../lib/crypto.js';
import type { Redis } from '../redis.js';

const RELEASE_SCRIPT = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;

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
