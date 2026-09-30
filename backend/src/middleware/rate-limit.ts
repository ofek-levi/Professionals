/**
 * Rate limiting on Redis (shared by every API instance; keys `${APP_ENV}:rl:<name>:<key>`).
 * Over the limit → 429 `RATE_LIMITED`. When Redis is unreachable requests pass (availability
 * over strictness). Disabled with `RATE_LIMIT_ENABLED=false` (tests).
 *
 * Usage in a router: `router.post('/auth/register', rateLimit(deps, 'register-ip', RATE_LIMITS.registerPerIp),
 * rateLimit(deps, 'register-email', { ...RATE_LIMITS.registerPerEmailAndIp, key: emailAndIpKey }), …)`.
 */
import type { Request, RequestHandler } from 'express';
import { ipKeyGenerator, rateLimit as expressRateLimit } from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';

import type { AppDeps } from '../deps.js';
import { withinFixedWindow } from '../infra/fixed-window.js';
import { KEY_SPACES } from '../infra/keys.js';
import { sha256 } from '../lib/crypto.js';
import { ApiError } from '../lib/errors.js';
import { bearerClaims } from './auth.js';

export interface RateLimitRule {
  windowMs: number;
  limit: number;
  /** Bucket key; `null` skips the limiter for this request. Default: client IP. */
  key?: (req: Request) => string | null;
}

const MINUTE = 60_000;

/**
 * Limits used across modules (per window). Signed-in traffic is limited per user: many mobile
 * subscribers share one carrier IP (CGNAT), so per-IP limits are for anonymous routes, and the
 * per-IP caps of the sign-in routes are generous; guessing is limited per account + IP instead
 * (`modules/auth/login-throttle.ts`).
 */
export const RATE_LIMITS = {
  /** Every /v1 request: per user with a valid bearer token, otherwise per IP. */
  global: { windowMs: MINUTE, limit: 600 },
  /** All sign-in attempts of one IP (argon2 CPU); failed ones are also limited by the login throttle. */
  loginPerIp: { windowMs: 15 * MINUTE, limit: 300 },
  registerPerIp: { windowMs: 60 * MINUTE, limit: 60 },
  /** Per (email, IP): a stranger elsewhere cannot use up the owner's sign-up attempts. */
  registerPerEmailAndIp: { windowMs: 60 * MINUTE, limit: 5 },
  googlePerIp: { windowMs: 15 * MINUTE, limit: 120 },
  /** An app refreshes about every 30 minutes; retries and concurrent refreshes stay far below this. */
  refreshPerSession: { windowMs: 15 * MINUTE, limit: 30 },
  refreshPerIp: { windowMs: 15 * MINUTE, limit: 3000 },
  passwordResetPerIp: { windowMs: 60 * MINUTE, limit: 30 },
  /**
   * Reset emails per address. Past it the request still answers 200 but sends nothing: the links
   * already sent stay valid, so a stranger cannot block the owner's reset (`password-reset.service`).
   */
  passwordResetEmailsPerAddress: { windowMs: 60 * MINUTE, limit: 3 },
  /** "Send the verification link again" (signed in). */
  verificationEmailsPerUser: { windowMs: 60 * MINUTE, limit: 3 },
  geoPerIp: { windowMs: MINUTE, limit: 60 },
  /** Geocoder cache misses (the provider takes 1 request/s for everyone): per IP when anonymous… */
  geoMissesPerIp: { windowMs: MINUTE, limit: 15 },
  /** …and per user when signed in. */
  geoMissesPerUser: { windowMs: MINUTE, limit: 30 },
  uploadsPerUser: { windowMs: 10 * MINUTE, limit: 60 },
  /** WebSocket upgrades (outside Express, see `server.ts`); the app reconnects every 3 s at most. */
  realtimeUpgradesPerUser: { windowMs: MINUTE, limit: 60 },
} as const satisfies Record<string, Omit<RateLimitRule, 'key'>>;

type Redis = AppDeps['redis'];

/** Client IP as rate limits see it (IPv6 grouped by /56, a customer's usual allocation). */
export function clientIpKey(req: Request): string {
  return `ip:${ipKeyGenerator(req.ip ?? 'unknown')}`;
}

/** Lower-cased `email` of the JSON body; `null` without one. */
function bodyEmail(req: Request): string | null {
  const email: unknown = (req.body as Record<string, unknown> | undefined)?.email;
  return typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null;
}

/** Per (email of the body, client IP); none → limiter skipped. */
export function emailAndIpKey(req: Request): string | null {
  const email = bodyEmail(req);
  return email ? `email:${sha256(email)}:${clientIpKey(req)}` : null;
}

/** Authenticated user (use after `requireAuth`). */
export function userKey(req: Request): string | null {
  return req.auth ? `user:${req.auth.userId.toHexString()}` : null;
}

/** The signed-in user of a valid bearer token (checked here: `requireAuth` runs later), else the IP. */
export function principalKey(deps: Pick<AppDeps, 'env' | 'clock'>): (req: Request) => string {
  return (req) => {
    const claims = bearerClaims(deps, req);
    return claims ? `user:${claims.userId}` : clientIpKey(req);
  };
}

function createStore(redis: Redis, prefix: string): RedisStore {
  return new RedisStore({
    sendCommand: (command: string, ...args: string[]) => redis.call(command, ...args) as Promise<RedisReply>,
    prefix,
  });
}

export function rateLimit(deps: Pick<AppDeps, 'env' | 'redis' | 'keys'>, name: string, rule: RateLimitRule): RequestHandler {
  if (!deps.env.rateLimit.enabled) return (_req, _res, next) => next();
  const keyOf = rule.key ?? clientIpKey;
  // `skip` and `keyGenerator` both need the key; compute it (a JWT check, for some keys) once.
  const computed = new WeakMap<Request, string | null>();
  const keyFor = (req: Request): string | null => {
    if (!computed.has(req)) computed.set(req, keyOf(req));
    return computed.get(req) ?? null;
  };
  return expressRateLimit({
    windowMs: rule.windowMs,
    limit: rule.limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    passOnStoreError: true,
    store: createStore(deps.redis, `${deps.keys.key(KEY_SPACES.rateLimit, name)}:`),
    skip: (req) => keyFor(req) === null,
    keyGenerator: (req) => keyFor(req) ?? 'none',
    handler: (_req, _res, next) => next(ApiError.rateLimited()),
  });
}

/**
 * Per-user budget of WebSocket upgrades (they bypass Express), for `attachRealtimeServer`'s
 * `allowUpgrade`; `undefined` when rate limiting is off. A Redis failure lets the upgrade through.
 */
export function realtimeUpgradeLimiter(deps: Pick<AppDeps, 'env' | 'redis' | 'keys' | 'logger'>): ((userId: string) => Promise<boolean>) | undefined {
  if (!deps.env.rateLimit.enabled) return undefined;
  const { windowMs, limit } = RATE_LIMITS.realtimeUpgradesPerUser;
  return async (userId) => {
    try {
      return await withinFixedWindow(deps.redis, deps.keys.key(KEY_SPACES.rateLimit, 'realtime-upgrade', userId), limit, windowMs);
    } catch (error) {
      deps.logger.warn({ err: error }, 'realtime upgrade limiter unavailable');
      return true;
    }
  };
}
