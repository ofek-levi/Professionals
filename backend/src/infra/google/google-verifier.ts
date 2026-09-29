/**
 * Verification of Google id tokens (sign-in and sign-up with Google). Signature, issuer, expiry
 * and audience (the app's web/iOS/Android client ids) are checked by google-auth-library;
 * unverified emails are rejected.
 */
import { OAuth2Client } from 'google-auth-library';

import { ApiError } from '../../lib/errors.js';

export interface GoogleIdentity {
  /** Stable Google account id. */
  sub: string;
  /** Lower-cased, verified email. */
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

export interface GoogleVerifier {
  readonly configured: boolean;
  /** Identity of a valid token, `null` for an invalid/expired/unverified one; 503 when Google is unreachable. */
  verify(idToken: string): Promise<GoogleIdentity | null>;
}

export class GoogleAuthVerifier implements GoogleVerifier {
  readonly configured = true;
  private readonly client = new OAuth2Client();

  constructor(private readonly clientIds: string[]) {}

  async verify(idToken: string): Promise<GoogleIdentity | null> {
    // Google's signing certificates are fetched (and cached until they expire) first, so an
    // outage answers 503 instead of blaming the user's token with a 401.
    try {
      await this.client.getFederatedSignonCertsAsync();
    } catch {
      throw ApiError.unavailable('Google sign-in is temporarily unavailable, please try again');
    }
    try {
      const ticket = await this.client.verifyIdToken({ idToken, audience: this.clientIds });
      const payload = ticket.getPayload();
      if (!payload?.sub || !payload.email || payload.email_verified !== true) return null;
      return {
        sub: payload.sub,
        email: payload.email.trim().toLowerCase(),
        firstName: payload.given_name ?? '',
        lastName: payload.family_name ?? '',
        avatarUrl: payload.picture ?? null,
      };
    } catch {
      return null;
    }
  }
}

/** Development without client ids: Google sign-in answers 503. */
export class UnconfiguredGoogleVerifier implements GoogleVerifier {
  readonly configured = false;

  verify(): Promise<GoogleIdentity | null> {
    return Promise.reject(ApiError.unavailable('Google sign-in is not configured on this server'));
  }
}
