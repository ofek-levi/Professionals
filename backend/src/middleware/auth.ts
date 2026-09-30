/**
 * Authentication and role checks. `requireAuth` verifies the `Authorization: Bearer <access
 * token>` JWT (no database hit; one Redis lookup refuses tokens of revoked sessions) and sets
 * `req.auth`; `requireRole` narrows to one role.
 * Controllers read the caller with `authOf(req)` / `authOf(req, 'professional')`.
 * A professional's profile id equals their user id, so `auth.userId` addresses both.
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { Types } from 'mongoose';

import { isSessionDenied, type SessionDenylistDeps } from '../infra/session-denylist.js';
import { verifyAccessToken, type AccessTokenClaims, type AccessTokenConfig } from '../lib/access-token.js';
import type { Clock } from '../lib/clock.js';
import { ApiError } from '../lib/errors.js';
import type { Logger } from '../lib/logger.js';
import type { UserRole } from '../shared/domain.js';

export interface AuthContext {
  userId: Types.ObjectId;
  role: UserRole;
  sessionId: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    /** Set by `requireAuth`. */
    auth?: AuthContext;
  }
}

function bearerToken(req: Request): string | null {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(req.headers.authorization ?? '');
  return match?.[1] ?? null;
}

export type AuthDeps = SessionDenylistDeps & { env: { jwt: AccessTokenConfig }; clock: Clock; logger: Logger };
type TokenDeps = Pick<AuthDeps, 'env' | 'clock'>;

/**
 * Claims of a valid (signed, unexpired) bearer token, without the revocation lookup: enough to key
 * rate limits by user or to name the session a logout ends. `null` without a valid token.
 */
export function bearerClaims(deps: TokenDeps, req: Request): AccessTokenClaims | null {
  const token = bearerToken(req);
  const claims = token ? verifyAccessToken(deps.env.jwt, token, deps.clock) : null;
  return claims && Types.ObjectId.isValid(claims.userId) ? claims : null;
}

export function requireAuth(deps: AuthDeps): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!bearerToken(req)) {
      next(ApiError.unauthorized());
      return;
    }
    const claims = bearerClaims(deps, req);
    if (!claims) {
      next(ApiError.unauthorized('Invalid or expired access token'));
      return;
    }
    if (await isSessionDenied(deps, claims.sessionId)) {
      next(ApiError.unauthorized('The session has ended, please sign in again'));
      return;
    }
    req.auth = { userId: new Types.ObjectId(claims.userId), role: claims.role, sessionId: claims.sessionId };
    next();
  };
}

/** Use after `requireAuth`: 403 for any other role. */
export function requireRole(role: UserRole): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) next(ApiError.unauthorized());
    else if (req.auth.role !== role) next(ApiError.forbidden(`This endpoint is only available to ${role}s`));
    else next();
  };
}

/** The authenticated caller (optionally asserting the role the route already enforced). */
export function authOf(req: Request, role?: UserRole): AuthContext {
  const auth = req.auth;
  if (!auth) throw ApiError.unauthorized();
  if (role && auth.role !== role) throw ApiError.forbidden(`This endpoint is only available to ${role}s`);
  return auth;
}
