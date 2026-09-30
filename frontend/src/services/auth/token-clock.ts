/**
 * Access-token expiry on this device's clock. The server sends an absolute `accessTokenExpiresAt`
 * (its own clock); a device clock that runs ahead by the token's lifetime (30 min) or more would see
 * every token as expired on arrival and refresh before each request (until rate limited). So the
 * expiry is re-based when the tokens arrive: now + the token's lifetime (`exp - iat` of the JWT,
 * both server times, so any offset cancels out). Tokens that are not readable JWTs keep the
 * server's value.
 */
import type { SessionTokens } from '@/types/api';

function decodeBase64Url(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  return atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '='));
}

/** The access token's lifetime in ms (`exp - iat`), or `null` when it is not a readable JWT. */
export function accessTokenLifetimeMs(accessToken: string): number | null {
  const payload = accessToken.split('.')[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(decodeBase64Url(payload)) as { iat?: unknown; exp?: unknown };
    if (typeof claims.iat !== 'number' || typeof claims.exp !== 'number' || claims.exp <= claims.iat) return null;
    return (claims.exp - claims.iat) * 1000;
  } catch {
    return null;
  }
}

/** `tokens` as just received, with `accessTokenExpiresAt` on this device's clock. */
export function onDeviceClock(tokens: SessionTokens, now: number = Date.now()): SessionTokens {
  const lifetime = accessTokenLifetimeMs(tokens.accessToken);
  if (lifetime === null) return tokens;
  return { ...tokens, accessTokenExpiresAt: new Date(now + lifetime).toISOString() };
}
