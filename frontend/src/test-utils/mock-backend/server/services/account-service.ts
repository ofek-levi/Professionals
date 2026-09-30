/**
 * Accounts of the test double: email/password sign-in, registration (customer or professional),
 * Google sign-in and password reset. Credentials live in the `credentials` table keyed by the
 * lower-cased email and hold salted password hashes only. Every sign-in starts a session
 * (`sessions.ts`).
 */
import { DomainError } from '@/features/shared/domain-error';
import {
  googleAuthRequestSchema,
  loginSchema,
  normalizeEmail,
  passwordResetRequestSchema,
  registerRequestSchema,
  type RegisterRequestInput,
} from '@/lib/validation/auth';
import { vm } from '@/lib/validation/messages';
import { googleAudiences } from '@/services/auth/google-client-ids';
import {
  decodeUnverifiedGoogleJwt,
  googleProfileFromClaims,
  isMockGoogleIdToken,
  parseMockGoogleIdToken,
  type GoogleIdTokenClaims,
} from '../google-id-token';
import type { AuthSession, GoogleAuthResponse, SuccessResponse } from '@/types/api';

import type { ServerContext } from '../context';
import type { StoredCredential, StoredUser } from '../db';
import { createCustomerProfile, createProfessional, createUser } from '../../factories';
import { SUCCESS } from '../handlers/shared';
import { hashPassword, verifyPassword } from '../passwords';
import { revokeAllSessions, startSession } from '../sessions';
import { parseBody } from '../validate';
import { toUser } from '../views';

/** Compared against when the email is unknown, so both failures take the same time. */
const UNKNOWN_ACCOUNT_HASH = hashPassword('not-a-password', '0000000000000000');

function sessionFor(ctx: ServerContext, user: StoredUser): AuthSession {
  return { ...startSession(ctx, user.id), user: toUser(user) };
}

/** User of a credential, provided the account (user + role profile) still exists. */
function userOfCredential(ctx: ServerContext, credential: StoredCredential | undefined): StoredUser | null {
  if (!credential) return null;
  const user = ctx.db.users.get(credential.userId);
  if (!user) return null;
  const hasProfile =
    user.role === 'customer'
      ? ctx.db.customerProfiles.has(user.id)
      : ctx.db.professionals.find((profile) => profile.userId === user.id) !== undefined;
  return hasProfile ? user : null;
}

function isEmailRegistered(ctx: ServerContext, email: string): boolean {
  return ctx.db.credentials.has(email) || ctx.db.users.find((user) => normalizeEmail(user.email) === email) !== undefined;
}

function emailTaken(): DomainError {
  return DomainError.conflict('An account with this email already exists', 'EMAIL_ALREADY_REGISTERED', {
    email: [vm('auth.emailTaken')],
  });
}

// ────────────────────────────── Google ──────────────────────────────

/**
 * Verifies a Google id token. Test tokens (`mock-google.…`) are decoded; a real Google JWT is
 * accepted after checking issuer, audience (the app's configured client ids), expiry and
 * `email_verified` – but NOT its signature (mock only; a real backend verifies it with Google's
 * public keys).
 */
function verifyGoogleIdToken(ctx: ServerContext, idToken: string): GoogleIdTokenClaims {
  const claims = isMockGoogleIdToken(idToken)
    ? parseMockGoogleIdToken(idToken)
    : decodeUnverifiedGoogleJwt(idToken, ctx.now(), googleAudiences());
  if (!claims) throw DomainError.invalidGoogleToken();
  return claims;
}

/**
 * `POST /auth/google`
 * 1. A Google account (`sub`) linked before signs in to its account – matched by `sub` only, since
 *    the address may have changed at Google.
 * 2. Otherwise the email decides: an account whose credential is linked to a *different* Google
 *    account is refused (e.g. a recycled or re-created address) with 401 `INVALID_GOOGLE_TOKEN`.
 * 3. An email account signed in with Google for the first time gets the Google account linked.
 *    Google verified the address, so an unverified password on it is dropped: it may have been set
 *    by someone else who registered the address first ("pre-account hijacking"), and every earlier
 *    session (and its push devices) is revoked. The owner can set a new password with "Forgot
 *    password?". Verified passwords keep working.
 * 4. Unknown → `registration_required` with the Google profile.
 */
export function signInWithGoogle(ctx: ServerContext, body: unknown): GoogleAuthResponse {
  const { idToken } = parseBody(googleAuthRequestSchema, body);
  const claims = verifyGoogleIdToken(ctx, idToken);

  const linked = ctx.db.credentials.find((credential) => credential.googleSubject === claims.sub);
  const linkedUser = userOfCredential(ctx, linked);
  if (linkedUser) return { status: 'signed_in', session: sessionFor(ctx, linkedUser) };

  const byEmail = ctx.db.credentials.get(claims.email);
  const user = userOfCredential(ctx, byEmail);
  if (byEmail && user) {
    if (byEmail.googleSubject !== null && byEmail.googleSubject !== claims.sub) {
      throw DomainError.invalidGoogleToken('This email is linked to a different Google account');
    }
    ctx.db.credentials.update(byEmail.email, {
      googleSubject: claims.sub,
      emailVerified: true,
      passwordHash: byEmail.emailVerified ? byEmail.passwordHash : null,
      updatedAt: ctx.nowIso(),
    });
    revokeAllSessions(ctx, user.id);
    return { status: 'signed_in', session: sessionFor(ctx, user) };
  }
  return { status: 'registration_required', profile: googleProfileFromClaims(claims) };
}

// ────────────────────────────── Email + password ──────────────────────────────

/** `POST /auth/login` – the same 401 for an unknown email, a wrong password or a Google-only account. */
export function login(ctx: ServerContext, body: unknown): AuthSession {
  const { email, password } = parseBody(loginSchema, body);
  const credential = ctx.db.credentials.get(email);
  const passwordMatches = verifyPassword(password, credential ? credential.passwordHash : UNKNOWN_ACCOUNT_HASH);
  const user = passwordMatches ? userOfCredential(ctx, credential) : null;
  if (!user) throw DomainError.invalidCredentials();
  return sessionFor(ctx, user);
}

/** `POST /auth/password-reset` – validates the email and always succeeds (no account enumeration). */
export function requestPasswordReset(_ctx: ServerContext, body: unknown): SuccessResponse {
  parseBody(passwordResetRequestSchema, body);
  // A real backend emails a single-use, short-lived reset link when the account exists.
  return SUCCESS;
}

// ────────────────────────────── Registration ──────────────────────────────

function createProfessionalProfile(ctx: ServerContext, user: StoredUser, payload: RegisterRequestInput): void {
  const details = payload.professional;
  if (!details) throw DomainError.validation({ professional: [vm('auth.professionalDetailsRequired')] });
  const now = ctx.nowIso();
  const fullName = `${payload.firstName} ${payload.lastName}`;
  ctx.db.professionals.insert(
    createProfessional({
      // Same convention as the seed: the profile id is the user id.
      id: user.id,
      userId: user.id,
      fullName,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      categoryIds: details.categoryIds,
      yearsOfExperience: 0,
      serviceArea: {
        center: { ...details.baseLocation.coordinates },
        radiusKm: details.serviceRadiusKm,
        label: details.baseLocation.city,
      },
      baseLocation: { ...details.baseLocation, isApproximate: false },
      contact: { phone: payload.phone, email: payload.email, website: null },
      business: {
        businessName: details.businessName,
        licenseNumber: null,
        isInsured: false,
        languages: [payload.preferredLanguage],
      },
      stats: { averageRating: null, reviewCount: 0, completedJobsCount: 0, responseTimeMinutes: null },
      isVerified: false,
      memberSince: now,
      updatedAt: now,
    }),
  );
}

/**
 * `POST /auth/register` – creates the user, the role profile and the credential, then signs in.
 * New professionals immediately see the open requests that match their services and area (the
 * explorer and dashboard are computed from the profile).
 */
export function register(ctx: ServerContext, body: unknown): AuthSession {
  const payload = parseBody(registerRequestSchema, body);
  const email = payload.email;

  let googleSubject: string | null = null;
  let avatarUrl: string | null = null;
  if (payload.googleIdToken) {
    const claims = verifyGoogleIdToken(ctx, payload.googleIdToken);
    if (claims.email !== email) throw DomainError.invalidGoogleToken('The Google account does not match the email address');
    if (ctx.db.credentials.find((credential) => credential.googleSubject === claims.sub)) throw emailTaken();
    googleSubject = claims.sub;
    avatarUrl = claims.picture;
  }
  if (isEmailRegistered(ctx, email)) throw emailTaken();

  const now = ctx.nowIso();
  const fullName = `${payload.firstName} ${payload.lastName}`;
  const businessName = payload.role === 'professional' ? payload.professional?.businessName ?? null : null;
  const user = ctx.db.users.insert(
    createUser({
      id: ctx.newId('user'),
      role: payload.role,
      firstName: payload.firstName,
      lastName: payload.lastName,
      displayName: businessName || fullName,
      email,
      phone: payload.phone,
      avatarUrl,
      preferredLanguage: payload.preferredLanguage,
      createdAt: now,
    }),
  );

  if (payload.role === 'customer') {
    ctx.db.customerProfiles.insert(createCustomerProfile({ userId: user.id, defaultLocation: null, updatedAt: now }));
  } else {
    createProfessionalProfile(ctx, user, payload);
  }

  ctx.db.credentials.insert({
    email,
    userId: user.id,
    passwordHash: payload.password !== null && !payload.googleIdToken ? hashPassword(payload.password) : null,
    googleSubject,
    // Google verified the address; a password sign-up would be verified by email (not simulated).
    emailVerified: googleSubject !== null,
    createdAt: now,
    updatedAt: now,
  });

  return sessionFor(ctx, user);
}
