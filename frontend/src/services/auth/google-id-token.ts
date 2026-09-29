/**
 * Google id-token helpers shared by the app (simulated Google sign-in) and the mock backend
 * (which "verifies" the token). Pure and dependency-free.
 *
 * Demo tokens look like `mock-google.<base64url(JSON {sub,email,given_name,family_name,picture})>`.
 * A real backend never accepts these: it verifies Google's signed JWT (signature, `aud` = one of
 * the app's OAuth client ids, `iss`, `exp`, `email_verified`) with Google's public keys.
 */
import type { GoogleProfile } from '@/types/api';
import { base64UrlDecodeText, base64UrlEncodeText } from '@/utils/encoding';
import { sha256Hex } from '@/utils/sha256';

export const MOCK_GOOGLE_TOKEN_PREFIX = 'mock-google.';

/** The OpenID claims a Google id token carries that the app uses. */
export interface GoogleIdTokenClaims {
  /** Stable Google account id. */
  sub: string;
  email: string;
  given_name: string;
  family_name: string;
  picture: string | null;
}

/** A Google identity (as picked in the simulated sheet or typed under "Use another account"). */
export interface GoogleIdentity {
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
}

/** Deterministic mock Google account id for an email (the same email always gets the same id). */
export function mockGoogleSubject(email: string): string {
  return `mock-${sha256Hex(email.trim().toLowerCase()).slice(0, 24)}`;
}

/** Builds a demo id token for a Google identity. */
export function buildMockGoogleIdToken(identity: GoogleIdentity): string {
  const email = identity.email.trim().toLowerCase();
  const claims: GoogleIdTokenClaims = {
    sub: mockGoogleSubject(email),
    email,
    given_name: identity.firstName.trim(),
    family_name: identity.lastName.trim(),
    picture: identity.avatarUrl ?? null,
  };
  return `${MOCK_GOOGLE_TOKEN_PREFIX}${base64UrlEncodeText(JSON.stringify(claims))}`;
}

export function isMockGoogleIdToken(token: string): boolean {
  return token.startsWith(MOCK_GOOGLE_TOKEN_PREFIX);
}

function parseJsonObject(text: string | null): Record<string, unknown> | null {
  if (text === null) return null;
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function toClaims(payload: Record<string, unknown>): GoogleIdTokenClaims | null {
  const { sub, email, given_name: givenName, family_name: familyName, picture } = payload;
  if (typeof sub !== 'string' || sub.length === 0) return null;
  if (typeof email !== 'string' || !EMAIL_PATTERN.test(email)) return null;
  return {
    sub,
    email: email.toLowerCase(),
    given_name: typeof givenName === 'string' ? givenName : '',
    family_name: typeof familyName === 'string' ? familyName : '',
    picture: typeof picture === 'string' && picture.length > 0 ? picture : null,
  };
}

/** Claims of a demo id token, or `null` when it is not a well-formed demo token. */
export function parseMockGoogleIdToken(token: string): GoogleIdTokenClaims | null {
  if (!isMockGoogleIdToken(token)) return null;
  const payload = parseJsonObject(base64UrlDecodeText(token.slice(MOCK_GOOGLE_TOKEN_PREFIX.length)));
  return payload ? toClaims(payload) : null;
}

const GOOGLE_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

/** `aud` of a JWT payload: a string or an array of strings. */
function audiencesOf(payload: Record<string, unknown>): string[] {
  const { aud } = payload;
  if (typeof aud === 'string') return [aud];
  return Array.isArray(aud) ? aud.filter((value): value is string => typeof value === 'string') : [];
}

/**
 * Claims of a real Google id token WITHOUT verifying its signature – only for the in-app mock
 * backend, so a developer can try real Google sign-in against mock data. Checks the issuer, that
 * the token was issued for one of `audiences` (the app's own OAuth client ids – tokens minted for
 * other apps are rejected; no audiences → every JWT is rejected), expiry (with the given clock) and
 * that the email is verified.
 *
 * ⚠️ NEVER use this on a server: without the signature check anyone can mint such a token. A real
 * backend verifies Google's signature with its public keys (e.g. `google-auth-library`).
 */
export function decodeUnverifiedGoogleJwt(token: string, now: Date, audiences: readonly string[]): GoogleIdTokenClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const payload = parseJsonObject(base64UrlDecodeText(parts[1]));
  if (!payload) return null;
  if (typeof payload.iss !== 'string' || !GOOGLE_ISSUERS.has(payload.iss)) return null;
  if (!audiencesOf(payload).some((aud) => audiences.includes(aud))) return null;
  if (typeof payload.exp !== 'number' || payload.exp * 1000 <= now.getTime()) return null;
  if (payload.email_verified !== true && payload.email_verified !== 'true') return null;
  return toClaims(payload);
}

/** The profile the sign-up flow is prefilled with. */
export function googleProfileFromClaims(claims: GoogleIdTokenClaims): GoogleProfile {
  return {
    email: claims.email,
    firstName: claims.given_name,
    lastName: claims.family_name,
    avatarUrl: claims.picture,
  };
}
