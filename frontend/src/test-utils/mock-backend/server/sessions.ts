/**
 * Sessions and tokens of the test double, with the backend's observable rules
 * (backend/docs/API.md → Auth → Tokens and sessions):
 * - one session per sign-in; an access token is valid 30 minutes (by the server clock) and names its
 *   session, so signing out or revoking the session makes it fail at once (401);
 * - the refresh token is opaque, names its session and rotates on every `POST /auth/refresh`;
 * - the token the last refresh replaced, presented again within 30 s, is answered with the same new
 *   refresh token (concurrent refresh, lost response); any other earlier token of the session is a
 *   replay: the session is revoked (and its push devices removed);
 * - a forged token (bad signature) is refused and revokes nothing.
 *
 * Tokens are `<kind>.<session id>.<number>.<signature>`; the signature is a hash with a fixed test
 * secret, which is all a test double needs to tell issued tokens from forged ones.
 */
import { DomainError } from '@/features/shared/domain-error';
import type { SessionTokens, SuccessResponse } from '@/types/api';

import type { ServerContext } from './context';
import type { MockDatabase, StoredSession } from './db';
import { SUCCESS } from './handlers/shared';
import { RouteResponse } from './router';
import { sha256Hex } from './sha256';

export const ACCESS_TOKEN_TTL_MS = 30 * 60_000;
export const REFRESH_TOKEN_TTL_MS = 90 * 24 * 60 * 60_000;
/** A replay of the just-replaced refresh token this soon after the rotation is a concurrent refresh. */
export const REFRESH_REPLAY_WINDOW_MS = 30_000;

const SECRET = 'test-double-secret';
const ACCESS = 'access';
const REFRESH = 'refresh';

interface ParsedToken {
  sessionId: string;
  /** Access token: expiry (ms since epoch). Refresh token: rotation number. */
  value: number;
}

const sign = (kind: string, sessionId: string, value: number) => sha256Hex(`${SECRET}:${kind}:${sessionId}:${value}`).slice(0, 16);

function mint(kind: string, sessionId: string, value: number): string {
  return `${kind}.${sessionId}.${value}.${sign(kind, sessionId, value)}`;
}

/** An issued token of `kind`, or `null` (malformed or forged). */
function parse(kind: string, token: string): ParsedToken | null {
  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== kind) return null;
  const [, sessionId, rawValue, signature] = parts;
  const value = Number(rawValue);
  if (!sessionId || !Number.isInteger(value) || signature !== sign(kind, sessionId, value)) return null;
  return { sessionId, value };
}

const rotationOf = (refreshToken: string) => parse(REFRESH, refreshToken)?.value ?? -1;

/** The session an issued access or refresh token names (`null` for anything else). */
export function sessionIdOfToken(token: string): string | null {
  return (parse(ACCESS, token) ?? parse(REFRESH, token))?.sessionId ?? null;
}

function accessTokenFor(ctx: ServerContext, sessionId: string): Pick<SessionTokens, 'accessToken' | 'accessTokenExpiresAt'> {
  const expiresAt = ctx.now().getTime() + ACCESS_TOKEN_TTL_MS;
  return { accessToken: mint(ACCESS, sessionId, expiresAt), accessTokenExpiresAt: new Date(expiresAt).toISOString() };
}

/** Starts a session for `userId` (sign-in, sign-up, Google). */
export function startSession(ctx: ServerContext, userId: string): SessionTokens {
  const id = ctx.newId('ses');
  const refreshToken = mint(REFRESH, id, 0);
  ctx.db.sessions.insert({
    id,
    userId,
    refreshToken,
    previousRefreshToken: null,
    rotatedAt: null,
    expiresAt: new Date(ctx.now().getTime() + REFRESH_TOKEN_TTL_MS).toISOString(),
    createdAt: ctx.nowIso(),
  });
  return { ...accessTokenFor(ctx, id), refreshToken };
}

/** A fresh access token of a live session (the test harness acts as a signed-in user with it). */
export function issueAccessToken(ctx: ServerContext, sessionId: string): string | null {
  return liveSession(ctx.db, sessionId, ctx.now()) ? accessTokenFor(ctx, sessionId).accessToken : null;
}

function liveSession(db: MockDatabase, sessionId: string, now: Date): StoredSession | null {
  const session = db.sessions.get(sessionId);
  return session && Date.parse(session.expiresAt) > now.getTime() ? session : null;
}

/** The session of a valid (issued, unexpired, not revoked) access token, else `null`. */
export function sessionOfAccessToken(db: MockDatabase, accessToken: string, now: Date): StoredSession | null {
  const parsed = parse(ACCESS, accessToken);
  if (!parsed || parsed.value <= now.getTime()) return null;
  return liveSession(db, parsed.sessionId, now);
}

/** Deletes the session and the push devices it registered; its sockets close with 4001. */
export function revokeSession(ctx: ServerContext, sessionId: string): void {
  if (!ctx.db.sessions.delete(sessionId)) return;
  ctx.db.devices.filter((device) => device.sessionId === sessionId).forEach((device) => ctx.db.devices.delete(device.id));
  ctx.sessionRevoked(sessionId);
}

/** Signs the account out everywhere (e.g. the first Google link of a password account). */
export function revokeAllSessions(ctx: ServerContext, userId: string): void {
  ctx.db.sessions.filter((session) => session.userId === userId).forEach((session) => revokeSession(ctx, session.id));
  ctx.db.devices.filter((device) => device.userId === userId).forEach((device) => ctx.db.devices.delete(device.id));
}

const sessionExpired = () => DomainError.unauthorized('The session has expired, please sign in again');

/**
 * `POST /auth/refresh`: rotates the refresh token and issues a new access token. A replay answers
 * 401 as a response (not a throw) so the revocation it causes is committed.
 */
export function refreshSession(ctx: ServerContext, refreshToken: string): SessionTokens | RouteResponse {
  const presented = parse(REFRESH, refreshToken);
  if (!presented) throw sessionExpired();
  const session = liveSession(ctx.db, presented.sessionId, ctx.now());
  if (!session) throw sessionExpired();

  if (session.refreshToken === refreshToken) {
    const next = mint(REFRESH, session.id, rotationOf(session.refreshToken) + 1);
    ctx.db.sessions.update(session.id, {
      refreshToken: next,
      previousRefreshToken: refreshToken,
      rotatedAt: ctx.nowIso(),
      expiresAt: new Date(ctx.now().getTime() + REFRESH_TOKEN_TTL_MS).toISOString(),
    });
    return { ...accessTokenFor(ctx, session.id), refreshToken: next };
  }

  const justReplaced =
    session.previousRefreshToken === refreshToken &&
    session.rotatedAt !== null &&
    ctx.now().getTime() - Date.parse(session.rotatedAt) < REFRESH_REPLAY_WINDOW_MS;
  if (justReplaced) return { ...accessTokenFor(ctx, session.id), refreshToken: session.refreshToken };

  // An earlier token of a live session: two parties hold it.
  revokeSession(ctx, session.id);
  const error = sessionExpired();
  return new RouteResponse(error.status, error.toBody());
}

/**
 * `POST /auth/logout`: revokes the session of the refresh token (any token issued for it) or,
 * without one, of the bearer token. Idempotent, never fails.
 */
export function logout(ctx: ServerContext, refreshToken: string | undefined, bearerToken: string | null): SuccessResponse {
  const sessionId = refreshToken
    ? parse(REFRESH, refreshToken)?.sessionId
    : bearerToken
      ? parse(ACCESS, bearerToken)?.sessionId
      : undefined;
  if (sessionId) revokeSession(ctx, sessionId);
  return SUCCESS;
}
