/**
 * Revoked sessions. Access tokens are stateless JWTs, so after a logout, a detected refresh-token
 * theft or a password reset they would stay usable until they expire (up to 30 minutes). Revoking a
 * session lists its id here for exactly that long; `requireAuth` and the realtime server refuse
 * tokens of listed sessions, and the ids are announced on a pub/sub channel so every instance
 * closes the open sockets of those sessions. Cost: one Redis EXISTS per authenticated request
 * (Redis is already on the request path for rate limiting). Like the rate limiter, a Redis failure
 * lets requests pass: the token is still signature-checked and short-lived.
 */
import type { Logger } from '../lib/logger.js';
import { API_LIMITS } from '../shared/limits.js';
import { KEY_SPACES, type RedisKeys } from './keys.js';
import type { Redis } from './redis.js';

export interface SessionDenylistDeps {
  redis: Redis;
  keys: RedisKeys;
}

/**
 * Longer than an access token lives, with a margin: a refresh that was already running when the
 * session was revoked may sign its access token a moment after the id was listed.
 */
const DENY_TTL_MS = (API_LIMITS.accessTokenTtlSeconds + 60) * 1000;

function denyKey(deps: SessionDenylistDeps, sessionId: string): string {
  return deps.keys.key(KEY_SPACES.revokedSession, sessionId);
}

export function sessionRevokedChannel(keys: RedisKeys): string {
  return keys.key(KEY_SPACES.sessionRevokedChannel);
}

export async function denySessions(deps: SessionDenylistDeps, sessionIds: readonly string[]): Promise<void> {
  if (sessionIds.length === 0) return;
  const pipeline = deps.redis.pipeline();
  for (const sessionId of sessionIds) pipeline.set(denyKey(deps, sessionId), '1', 'PX', DENY_TTL_MS);
  pipeline.publish(sessionRevokedChannel(deps.keys), JSON.stringify(sessionIds));
  await pipeline.exec();
}

export async function isSessionDenied(deps: SessionDenylistDeps & { logger: Logger }, sessionId: string): Promise<boolean> {
  try {
    return (await deps.redis.exists(denyKey(deps, sessionId))) === 1;
  } catch (error) {
    deps.logger.warn({ err: error }, 'session denylist unavailable; token accepted');
    return false;
  }
}
