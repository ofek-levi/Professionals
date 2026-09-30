/**
 * Password-guessing limits that a stranger cannot turn into a lockout of someone else's account.
 * Only FAILED sign-ins count (the correct password never uses up anything), in 15-minute windows:
 * - per account + IP (10): one source guessing one account's password;
 * - per IP (100): one source spraying many accounts. Generous, because many mobile subscribers
 *   share one carrier IP (CGNAT);
 * - per account from all IPs (50): distributed guessing. A stranger with several IPs could fill
 *   it, so it does not apply to an IP that signed in to this account successfully in the last 30
 *   days, and a password reset (which proves the mailbox) clears it.
 * The address is hashed in Redis keys. A Redis failure lets sign-ins through (as the rate limiter).
 */
import type { AppDeps } from '../../deps.js';
import { fixedWindowTotal, hitFixedWindow } from '../../infra/fixed-window.js';
import { KEY_SPACES } from '../../infra/keys.js';
import { sha256 } from '../../lib/crypto.js';
import { ApiError } from '../../lib/errors.js';

const MINUTE = 60_000;

export const LOGIN_THROTTLE = {
  windowMs: 15 * MINUTE,
  failuresPerAccountAndIp: 10,
  failuresPerIp: 100,
  failuresPerAccount: 50,
  /** How long a successful sign-in makes an IP "known" for the account. */
  knownClientMs: 30 * 24 * 60 * MINUTE,
} as const;

type ThrottleDeps = Pick<AppDeps, 'env' | 'redis' | 'keys' | 'logger'>;

/** One sign-in attempt: the (normalized) email and the client IP key (`clientIpKey`). */
export interface LoginAttempt {
  email: string;
  ip: string;
}

function keysOf(deps: ThrottleDeps, attempt: LoginAttempt) {
  const account = sha256(attempt.email);
  const key = (...parts: string[]) => deps.keys.key(KEY_SPACES.rateLimit, ...parts);
  return {
    accountAndIp: key('login-fail', 'account-ip', account, attempt.ip),
    ip: key('login-fail', 'ip', attempt.ip),
    account: key('login-fail', 'account', account),
    known: key('login-known', account, attempt.ip),
  };
}

async function failOpen<T>(deps: ThrottleDeps, fallback: T, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    deps.logger.warn({ err: error }, 'login throttle unavailable');
    return fallback;
  }
}

/** Throws 429 `RATE_LIMITED` before the password is checked when a limit is used up. */
export async function assertLoginAllowed(deps: ThrottleDeps, attempt: LoginAttempt): Promise<void> {
  if (!deps.env.rateLimit.enabled) return;
  const keys = keysOf(deps, attempt);
  await failOpen(deps, undefined, async () => {
    const [accountAndIp, ip, account, known] = await Promise.all([
      fixedWindowTotal(deps.redis, keys.accountAndIp),
      fixedWindowTotal(deps.redis, keys.ip),
      fixedWindowTotal(deps.redis, keys.account),
      deps.redis.exists(keys.known),
    ]);
    const blocked =
      accountAndIp >= LOGIN_THROTTLE.failuresPerAccountAndIp ||
      ip >= LOGIN_THROTTLE.failuresPerIp ||
      (account >= LOGIN_THROTTLE.failuresPerAccount && known === 0);
    if (blocked) throw ApiError.rateLimited('Too many failed sign-in attempts, please try again later');
  });
}

export async function recordLoginFailure(deps: ThrottleDeps, attempt: LoginAttempt): Promise<void> {
  if (!deps.env.rateLimit.enabled) return;
  const keys = keysOf(deps, attempt);
  const { windowMs } = LOGIN_THROTTLE;
  await failOpen(deps, undefined, async () => {
    await Promise.all([keys.accountAndIp, keys.ip, keys.account].map((key) => hitFixedWindow(deps.redis, key, windowMs)));
  });
}

/** Remembers the IP for this account and forgets its failures from there. */
export async function recordLoginSuccess(deps: ThrottleDeps, attempt: LoginAttempt): Promise<void> {
  if (!deps.env.rateLimit.enabled) return;
  const keys = keysOf(deps, attempt);
  await failOpen(deps, undefined, async () => {
    await deps.redis.multi().set(keys.known, '1', 'PX', LOGIN_THROTTLE.knownClientMs).del(keys.accountAndIp).exec();
  });
}

/** After a password reset: the owner proved the mailbox, so the account-wide failures are dropped. */
export async function clearAccountLoginFailures(deps: ThrottleDeps, email: string): Promise<void> {
  if (!deps.env.rateLimit.enabled) return;
  await failOpen(deps, undefined, async () => {
    await deps.redis.del(keysOf(deps, { email, ip: '' }).account);
  });
}
