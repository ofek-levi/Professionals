/**
 * Rate limiting on Redis (shared by every API instance; keys `${APP_ENV}:rl:<name>:<key>`).
 * Over the limit → 429 `RATE_LIMITED`. When Redis is unreachable requests pass (availability
 * over strictness). Disabled with `RATE_LIMIT_ENABLED=false` (tests).
 *
 * Usage in a router: `router.post('/auth/login', rateLimit(deps, 'login-ip', RATE_LIMITS.loginPerIp),
 * rateLimit(deps, 'login-email', { ...RATE_LIMITS.loginPerEmail, key: emailKey }), …)`.
 */
import type { Request, RequestHandler } from 'express';
import { ipKeyGenerator, rateLimit as expressRateLimit } from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';

import type { AppDeps } from '../deps.js';
import { KEY_SPACES } from '../infra/keys.js';
import { ApiError } from '../lib/errors.js';

export interface RateLimitRule {
  windowMs: number;
  limit: number;
  /** Bucket key; `null` skips the limiter for this request. Default: client IP. */
  key?: (req: Request) => string | null;
}

const MINUTE = 60_000;

/** Limits used across modules (per window). */
export const RATE_LIMITS = {
  /** Every /v1 request per IP. */
  global: { windowMs: MINUTE, limit: 600 },
  loginPerIp: { windowMs: 15 * MINUTE, limit: 30 },
  loginPerEmail: { windowMs: 15 * MINUTE, limit: 10 },
  registerPerIp: { windowMs: 60 * MINUTE, limit: 20 },
  registerPerEmail: { windowMs: 60 * MINUTE, limit: 5 },
  googlePerIp: { windowMs: 15 * MINUTE, limit: 30 },
  refreshPerIp: { windowMs: 15 * MINUTE, limit: 120 },
  passwordResetPerIp: { windowMs: 60 * MINUTE, limit: 10 },
  passwordResetPerEmail: { windowMs: 60 * MINUTE, limit: 3 },
  geoPerIp: { windowMs: MINUTE, limit: 60 },
  uploadsPerUser: { windowMs: 10 * MINUTE, limit: 60 },
} as const satisfies Record<string, Omit<RateLimitRule, 'key'>>;

type Redis = AppDeps['redis'];

/** Lower-cased `email` of the JSON body (per-account limits); none → limiter skipped. */
export function emailKey(req: Request): string | null {
  const email: unknown = (req.body as Record<string, unknown> | undefined)?.email;
  return typeof email === 'string' && email.trim() ? `email:${email.trim().toLowerCase()}` : null;
}

/** Authenticated user (use after `requireAuth`). */
export function userKey(req: Request): string | null {
  return req.auth ? `user:${req.auth.userId.toHexString()}` : null;
}

function ipKey(req: Request): string {
  return `ip:${ipKeyGenerator(req.ip ?? 'unknown')}`;
}

function createStore(redis: Redis, prefix: string): RedisStore {
  return new RedisStore({
    sendCommand: (command: string, ...args: string[]) => redis.call(command, ...args) as Promise<RedisReply>,
    prefix,
  });
}

export function rateLimit(deps: Pick<AppDeps, 'env' | 'redis' | 'keys'>, name: string, rule: RateLimitRule): RequestHandler {
  if (!deps.env.rateLimit.enabled) return (_req, _res, next) => next();
  const keyOf = rule.key ?? ipKey;
  return expressRateLimit({
    windowMs: rule.windowMs,
    limit: rule.limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    passOnStoreError: true,
    store: createStore(deps.redis, `${deps.keys.key(KEY_SPACES.rateLimit, name)}:`),
    skip: (req) => keyOf(req) === null,
    keyGenerator: (req) => keyOf(req) ?? 'none',
    handler: (_req, _res, next) => next(ApiError.rateLimited()),
  });
}
