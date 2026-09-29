/** Redis clients: one for commands (cache, locks, rate limits) and one per subscriber. */
import { Redis } from 'ioredis';

export type { Redis };

export function createRedis(url: string, name: string): Redis {
  return new Redis(url, {
    connectionName: name,
    maxRetriesPerRequest: 3,
    enableAutoPipelining: true,
    lazyConnect: false,
  });
}

export async function pingRedis(redis: Redis): Promise<boolean> {
  await redis.ping();
  return true;
}

export async function closeRedis(redis: Redis): Promise<void> {
  try {
    await redis.quit();
  } catch {
    redis.disconnect();
  }
}
