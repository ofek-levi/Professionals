/**
 * Access tokens: HS256 JWTs valid for 30 minutes, carrying the user id (`sub`), role and session
 * id (`sid`). Verified by `requireAuth` and by the realtime server; refresh tokens are opaque and
 * live in the `sessions` collection (auth module).
 */
import jwt from 'jsonwebtoken';

import { USER_ROLES, type UserRole } from '../shared/domain.js';
import { API_LIMITS } from '../shared/limits.js';
import type { Clock } from './clock.js';

export interface AccessTokenConfig {
  accessSecret: string;
  issuer: string;
  audience: string;
}

export interface AccessTokenClaims {
  userId: string;
  role: UserRole;
  sessionId: string;
  /** Expiry (seconds since epoch). */
  expiresAt: number;
}

const TOKEN_TYPE = 'access';

export function signAccessToken(
  config: AccessTokenConfig,
  subject: { userId: string; role: UserRole; sessionId: string },
  clock: Clock,
): { token: string; expiresAt: Date } {
  const issuedAt = Math.floor(clock.now().getTime() / 1000);
  const exp = issuedAt + API_LIMITS.accessTokenTtlSeconds;
  const token = jwt.sign(
    { role: subject.role, sid: subject.sessionId, typ: TOKEN_TYPE, iat: issuedAt, exp },
    config.accessSecret,
    { algorithm: 'HS256', subject: subject.userId, issuer: config.issuer, audience: config.audience },
  );
  return { token, expiresAt: new Date(exp * 1000) };
}

/** Claims of a valid token, or `null` (bad signature, expired, wrong issuer/audience/type). */
export function verifyAccessToken(config: AccessTokenConfig, token: string, clock: Clock): AccessTokenClaims | null {
  try {
    const payload = jwt.verify(token, config.accessSecret, {
      algorithms: ['HS256'],
      issuer: config.issuer,
      audience: config.audience,
      clockTimestamp: Math.floor(clock.now().getTime() / 1000),
    });
    if (typeof payload === 'string') return null;
    const { sub, role, sid, typ, exp } = payload as Record<string, unknown>;
    if (typ !== TOKEN_TYPE || typeof sub !== 'string' || typeof sid !== 'string' || typeof exp !== 'number') return null;
    if (!(USER_ROLES as readonly unknown[]).includes(role)) return null;
    return { userId: sub, role: role as UserRole, sessionId: sid, expiresAt: exp };
  } catch {
    return null;
  }
}
