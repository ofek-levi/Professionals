/**
 * Rate limiting on Redis (shared by every API instance; keys `${APP_ENV}:rl:<name>:<key>`).
 * Over the limit → 429 `RATE_LIMITED`. When Redis is unreachable requests pass (availability
 * over strictness). Disabled with `RATE_LIMIT_ENABLED=false` (tests).
 *
 * Every route has a limiter of its own besides the global one (`route-rate-limits.test.ts` checks it):
 * `router.post('/auth/register', rateLimit(deps, 'register-ip', RATE_LIMITS.registerPerIp), …)`, or
 * after `requireAuth` `const limit = userRouteLimits(deps); router.get('/jobs', auth, limit.read('jobs-list'), …)`.
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';
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
  /** The error of a refused request. Default: a plain 429 `RATE_LIMITED`. */
  refusal?: () => ApiError;
  /** Answers a refused request instead of `refusal` (HTML pages). */
  onRefused?: (req: Request, res: Response, next: NextFunction) => void;
  /** Counts in this process's memory instead of Redis (health checks must not depend on Redis). */
  perInstance?: boolean;
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
  /** Per route of a signed-in user (`userRouteLimits`): reading their data (lists, details, counts)… */
  userReads: { windowMs: MINUTE, limit: 120 },
  /** …geospatial searches (browsing professionals, nearby requests)… */
  userSearches: { windowMs: MINUTE, limit: 60 },
  /** …changes (profile edits, job and offer steps, devices, reviews)… */
  userWrites: { windowMs: MINUTE, limit: 30 },
  /** …and read markers: an open chat marks the conversation read on every incoming message. */
  readMarkers: { windowMs: MINUTE, limit: 120 },
  /** Generous for a human typing, low enough to stop scripted flooding of a counterpart. */
  messagesPerUser: { windowMs: MINUTE, limit: 60 },
  /** New offers per professional (anti-spam; far above what one person sends). */
  offersPerUser: { windowMs: 10 * MINUTE, limit: 60 },
  /** New requests per customer (anti-spam; a real customer posts a few a day). */
  requestsPerUser: { windowMs: 60 * MINUTE, limit: 30 },
  /** Public data (the category catalog): per user when signed in, otherwise per IP. */
  publicReads: { windowMs: MINUTE, limit: 300 },
  /** All sign-in attempts of one IP (argon2 CPU); failed ones are also limited by the login throttle. */
  loginPerIp: { windowMs: 15 * MINUTE, limit: 300 },
  registerPerIp: { windowMs: 60 * MINUTE, limit: 60 },
  /** Per (email, IP): a stranger elsewhere cannot use up the owner's sign-up attempts. */
  registerPerEmailAndIp: { windowMs: 60 * MINUTE, limit: 5 },
  googlePerIp: { windowMs: 15 * MINUTE, limit: 120 },
  /** An app refreshes about every 30 minutes; retries and concurrent refreshes stay far below this. */
  refreshPerSession: { windowMs: 15 * MINUTE, limit: 30 },
  refreshPerIp: { windowMs: 15 * MINUTE, limit: 3000 },
  logoutPerIp: { windowMs: 15 * MINUTE, limit: 600 },
  passwordResetPerIp: { windowMs: 60 * MINUTE, limit: 30 },
  /**
   * Reset emails per address. Past it the request still answers 200 but sends nothing: the links
   * already sent stay valid, so a stranger cannot block the owner's reset (`password-reset.service`).
   */
  passwordResetEmailsPerAddress: { windowMs: 60 * MINUTE, limit: 3 },
  /** "Send the verification link again" (signed in). */
  verificationEmailsPerUser: { windowMs: 60 * MINUTE, limit: 3 },
  /** Pages opened from auth emails and their form posts (tokens are unguessable; this caps the load). */
  emailLinkPagesPerIp: { windowMs: 15 * MINUTE, limit: 300 },
  geoPerIp: { windowMs: MINUTE, limit: 60 },
  /** Geocoder cache misses (the provider takes 1 request/s for everyone): per IP when anonymous… */
  geoMissesPerIp: { windowMs: MINUTE, limit: 15 },
  /** …and per user when signed in. */
  geoMissesPerUser: { windowMs: MINUTE, limit: 30 },
  /**
   * Posts that may carry images (new requests, draft edits, avatars; a request takes up to 6 photos).
   * How many run at once and the bytes stored per day are limited too (`image-admission.ts`,
   * `image-quota.ts`).
   */
  imagesPerUser: { windowMs: 60 * MINUTE, limit: 60 },
  /** WebSocket upgrades (outside Express, see `server.ts`); the app reconnects every 3 s at most. */
  realtimeUpgradesPerUser: { windowMs: MINUTE, limit: 60 },
  /** `/health`, `/ready` per IP, in each instance's memory; load balancers probe every few seconds. */
  healthPerIp: { windowMs: MINUTE, limit: 300 },
} as const satisfies Record<string, Pick<RateLimitRule, 'windowMs' | 'limit'>>;

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

const LIMITER_NAME = Symbol('rateLimitName');

/** The name a `rateLimit` middleware was created with (route coverage test); `undefined` for other handlers. */
export function rateLimitName(handler: unknown): string | undefined {
  return (handler as { [LIMITER_NAME]?: string } | null)?.[LIMITER_NAME];
}

function named(name: string, handler: RequestHandler): RequestHandler {
  return Object.defineProperty(handler, LIMITER_NAME, { value: name });
}

export function rateLimit(deps: Pick<AppDeps, 'env' | 'redis' | 'keys'>, name: string, rule: RateLimitRule): RequestHandler {
  if (!deps.env.rateLimit.enabled) return named(name, (_req, _res, next) => next());
  const keyOf = rule.key ?? clientIpKey;
  // `skip` and `keyGenerator` both need the key; compute it (a JWT check, for some keys) once.
  const computed = new WeakMap<Request, string | null>();
  const keyFor = (req: Request): string | null => {
    if (!computed.has(req)) computed.set(req, keyOf(req));
    return computed.get(req) ?? null;
  };
  const limiter = expressRateLimit({
    windowMs: rule.windowMs,
    limit: rule.limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    passOnStoreError: true,
    // Without a store: express-rate-limit's in-memory one.
    ...(rule.perInstance ? {} : { store: createStore(deps.redis, `${deps.keys.key(KEY_SPACES.rateLimit, name)}:`) }),
    skip: (req) => keyFor(req) === null,
    keyGenerator: (req) => keyFor(req) ?? 'none',
    handler: (req, res, next) => {
      if (rule.onRefused) rule.onRefused(req, res, next);
      else next(rule.refusal?.() ?? ApiError.rateLimited());
    },
  });
  return named(name, limiter);
}

type UserRouteLimit = (name: string) => RequestHandler;

/**
 * Per-route budgets of the signed-in user (use after `requireAuth`): each `name` is a bucket of its
 * own, so a busy screen cannot use up another route's budget.
 */
export function userRouteLimits(deps: Pick<AppDeps, 'env' | 'redis' | 'keys'>): Record<'read' | 'search' | 'write' | 'readMarker', UserRouteLimit> {
  const perUser =
    (rule: Pick<RateLimitRule, 'windowMs' | 'limit'>): UserRouteLimit =>
    (name) =>
      rateLimit(deps, name, { ...rule, key: userKey });
  return {
    read: perUser(RATE_LIMITS.userReads),
    search: perUser(RATE_LIMITS.userSearches),
    write: perUser(RATE_LIMITS.userWrites),
    readMarker: perUser(RATE_LIMITS.readMarkers),
  };
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
