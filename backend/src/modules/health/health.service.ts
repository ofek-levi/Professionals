/** Readiness: the API can serve traffic only with MongoDB and Redis reachable. */
import type { AppDeps } from '../../deps.js';
import { pingMongo } from '../../infra/mongo.js';
import { pingRedis } from '../../infra/redis.js';

export interface Readiness {
  ready: boolean;
  checks: { mongo: 'ok' | 'down'; redis: 'ok' | 'down' };
}

const TIMEOUT_MS = 2000;

async function probe(check: () => Promise<boolean>): Promise<'ok' | 'down'> {
  try {
    const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), TIMEOUT_MS).unref());
    return (await Promise.race([check(), timeout])) ? 'ok' : 'down';
  } catch {
    return 'down';
  }
}

export async function checkReadiness(deps: Pick<AppDeps, 'redis'>): Promise<Readiness> {
  const [mongo, redis] = await Promise.all([probe(pingMongo), probe(() => pingRedis(deps.redis))]);
  return { ready: mongo === 'ok' && redis === 'ok', checks: { mongo, redis } };
}
