/**
 * Refresh-token format: `<sessionId>.<secret>.<tag>` (24 hex + 43 + 22 base64url characters).
 *
 * - `sessionId` finds the session by primary key, so ANY token ever issued for a live session is
 *   recognised, not only the current one and the one rotated just before it. A thief who rotates a
 *   stolen token twice can no longer make the owner's older token look merely "unknown".
 * - `tag` = HMAC(key, sessionId.secret): only this server mints tokens for a session. A token with
 *   a valid tag that is not the session's current one was rotated away → replay → the session is
 *   revoked. A token without a valid tag is a forgery (session ids are guessable ObjectIds) and is
 *   just refused, so strangers cannot revoke other people's sessions.
 * - The successor of a token is derived from it (HMAC), not drawn at random: two concurrent
 *   refreshes with the same token, or a retry after a lost response, receive the SAME next token
 *   inside the grace window instead of forking the session into two live branches.
 *
 * The key is derived from `JWT_ACCESS_SECRET`: whoever holds that secret can already mint access
 * tokens for anyone. Rotating the secret keeps sessions working (lookups use the stored hash); only
 * the reuse detection of tokens issued before the rotation is lost.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

import { Types } from 'mongoose';

import { randomToken } from '../../lib/crypto.js';

const TOKEN_PATTERN = /^([0-9a-f]{24})\.([A-Za-z0-9_-]{43})\.([A-Za-z0-9_-]{22})$/;
const TAG_BYTES = 16;

export interface ParsedRefreshToken {
  sessionId: Types.ObjectId;
  /** The tag proves this server issued the token for this session. */
  authentic: boolean;
}

/** Key of refresh-token tags and successors, derived from the access-token secret. */
export function refreshTokenKey(accessSecret: string): Buffer {
  return createHmac('sha256', accessSecret).update('refresh-token/v1').digest();
}

function mac(key: Buffer, label: string, value: string): Buffer {
  return createHmac('sha256', key).update(`${label}|${value}`).digest();
}

function withTag(key: Buffer, sessionId: string, secret: string): string {
  const body = `${sessionId}.${secret}`;
  return `${body}.${mac(key, 'tag', body).subarray(0, TAG_BYTES).toString('base64url')}`;
}

/** First token of a new session (random secret). */
export function mintRefreshToken(key: Buffer, sessionId: Types.ObjectId): string {
  return withTag(key, sessionId.toHexString(), randomToken(32));
}

/** The token a refresh with `token` hands out (deterministic, see the file comment). */
export function successorToken(key: Buffer, token: string, sessionId: Types.ObjectId): string {
  return withTag(key, sessionId.toHexString(), mac(key, 'next', token).toString('base64url'));
}

/** Session id and authenticity of a well-formed token; `null` for anything else. */
export function parseRefreshToken(key: Buffer, token: string): ParsedRefreshToken | null {
  const match = TOKEN_PATTERN.exec(token);
  if (!match?.[1] || !match[2] || !match[3]) return null;
  const expected = mac(key, 'tag', `${match[1]}.${match[2]}`).subarray(0, TAG_BYTES);
  const presented = Buffer.from(match[3], 'base64url');
  return {
    sessionId: new Types.ObjectId(match[1]),
    authentic: presented.length === TAG_BYTES && timingSafeEqual(presented, expected),
  };
}

/**
 * Rate-limit key of `POST /auth/refresh`: the session of a genuine token (a forged one naming
 * someone's session must not use up that session's budget), else `null` (per-IP limit only).
 */
export function refreshSessionKey(accessSecret: string): (req: { body?: unknown }) => string | null {
  const key = refreshTokenKey(accessSecret);
  return (req) => {
    const token: unknown = (req.body as Record<string, unknown> | undefined)?.refreshToken;
    const parsed = typeof token === 'string' ? parseRefreshToken(key, token.trim()) : null;
    return parsed?.authentic ? `session:${parsed.sessionId.toHexString()}` : null;
  };
}
