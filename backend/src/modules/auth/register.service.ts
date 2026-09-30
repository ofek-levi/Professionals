/**
 * `POST /auth/register`: creates the user, the role data (customer fields live on the user; a
 * professional also gets the profile) and the first session in ONE transaction, as the mock's
 * `account-service` does. Both sign-ups (password and Google) accept the terms (`acceptedTerms`),
 * recorded with the version in force. Password sign-ups then get a verification email; Google
 * sign-ups are verified by Google.
 */
import type { Types } from 'mongoose';

import { LEGAL_CONFIG } from '../../config/legal.js';
import type { AppDeps } from '../../deps.js';
import type { GoogleIdentity } from '../../infra/google/index.js';
import { withTransaction } from '../../infra/mongo.js';
import { toLocationDoc } from '../../infra/schema-parts.js';
import { ApiError, isDuplicateKeyError } from '../../lib/errors.js';
import { toGeoPoint } from '../../lib/geo.js';
import { newObjectId } from '../../lib/ids.js';
import { fullName } from '../../lib/text.js';
import type { AuthSession } from '../../shared/contract/index.js';
import { vm } from '../../shared/validation-messages.js';
import { ProfessionalModel } from '../professionals/professional.model.js';
import { UserModel, type UserDoc } from '../users/user.model.js';
import { sendVerificationEmail } from './auth-mail.service.js';
import type { RegisterInput } from './auth.schemas.js';
import { toAuthSession } from './auth.views.js';
import { assertPasswordNotBreached } from './password-rules.js';
import { hashPassword } from './passwords.js';
import { startSession } from './session.service.js';

type RegisterDeps = Pick<AppDeps, 'env' | 'clock' | 'logger' | 'google' | 'mailer' | 'background' | 'passwordBreach'>;
type ProfessionalDetails = NonNullable<RegisterInput['professional']>;

function emailTaken(): ApiError {
  return ApiError.conflict('An account with this email already exists', 'EMAIL_ALREADY_REGISTERED', { email: [vm('auth.emailTaken')] });
}

/** The Google identity of a Google sign-up; it must be the address being registered. */
async function verifiedGoogleIdentity(deps: RegisterDeps, idToken: string, email: string): Promise<GoogleIdentity> {
  const identity = await deps.google.verify(idToken);
  if (!identity) throw ApiError.invalidGoogleToken();
  if (identity.email !== email) throw ApiError.invalidGoogleToken('The Google account does not match the email address');
  return identity;
}

/** Service area centered on the base address, default availability, zero stats, not verified. */
function professionalProfile(userId: Types.ObjectId, input: RegisterInput, details: ProfessionalDetails) {
  return {
    _id: userId,
    displayName: details.businessName ?? fullName(input),
    categoryIds: details.categoryIds,
    serviceArea: {
      center: toGeoPoint(details.baseLocation.coordinates),
      radiusKm: details.serviceRadiusKm,
      label: details.baseLocation.city,
    },
    baseLocation: toLocationDoc(details.baseLocation),
    contact: { phone: input.phone, email: input.email, website: null },
    business: { businessName: details.businessName, licenseNumber: null, isInsured: false, languages: [input.preferredLanguage] },
  };
}

export async function register(deps: RegisterDeps, input: RegisterInput): Promise<AuthSession> {
  const google = input.googleIdToken ? await verifiedGoogleIdentity(deps, input.googleIdToken, input.email) : null;
  const [emailInUse, googleInUse] = await Promise.all([
    UserModel.exists({ email: input.email }),
    google ? UserModel.exists({ googleSub: google.sub }) : null,
  ]);
  if (emailInUse || googleInUse) throw emailTaken();
  const password = google ? null : input.password;
  if (password !== null) await assertPasswordNotBreached(deps, password);
  // Slow on purpose (argon2): done before the transaction so it does not hold it open.
  const passwordHash = password === null ? undefined : await hashPassword(password);
  const details = input.role === 'professional' ? input.professional : null;
  const userId = newObjectId();
  const now = deps.clock.now();

  const created = await withTransaction(deps.logger, async (tx) => {
    const [user] = await UserModel.create(
      [
        {
          _id: userId,
          email: input.email,
          passwordHash,
          googleSub: google?.sub,
          emailVerifiedAt: google ? now : undefined,
          role: input.role,
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
          language: input.preferredLanguage,
          avatar: google?.avatarUrl ? { url: google.avatarUrl, publicId: null } : null,
          termsAcceptance: { version: LEGAL_CONFIG.effectiveDate, acceptedAt: now },
        },
      ],
      { session: tx.session },
    );
    if (!user) throw new Error('user was not created');
    const profile = details ? professionalProfile(userId, input, details) : null;
    if (profile) await ProfessionalModel.create([profile], { session: tx.session });
    const tokens = await startSession(deps, user, tx.session);
    return { user: user.toObject<UserDoc>(), displayName: profile?.displayName ?? null, tokens };
  }).catch((error: unknown) => {
    // A concurrent sign-up with the same email (or Google account) won the unique index.
    throw isDuplicateKeyError(error) ? emailTaken() : error;
  });

  if (!google) deps.background.run('verification-email', () => sendVerificationEmail(deps, created.user));
  return toAuthSession(created.tokens, created.user, created.displayName);
}
