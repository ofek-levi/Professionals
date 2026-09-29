/**
 * `POST /auth/google` with the linking rules of BACKEND_INTEGRATION.md §3 (as the mock's
 * `signInWithGoogle`):
 * 1. An account linked to this Google account (`sub`) signs in; matched by `sub` only, since the
 *    address may have changed at Google.
 * 2. Otherwise the email decides. An account linked to a *different* Google account is refused
 *    (a recycled or re-created address): 401 `INVALID_GOOGLE_TOKEN`, never a sign-in by email alone.
 * 3. An email + password account signing in with Google for the first time gets it linked. If its
 *    email was never verified, the password may have been set by someone who registered the
 *    address before its owner ("pre-account hijacking"): the password is dropped and every
 *    session revoked; the email is now verified by Google. A verified password keeps working.
 * 4. Unknown → `registration_required` with the Google profile (the app finishes the sign-up).
 */
import type { AppDeps } from '../../deps.js';
import type { GoogleIdentity } from '../../infra/google/index.js';
import { withTransaction } from '../../infra/mongo.js';
import { ApiError } from '../../lib/errors.js';
import type { AuthSession, GoogleAuthResponse } from '../../shared/contract/index.js';
import { UserModel, type UserDoc } from '../users/user.model.js';
import { USER_VIEW_PROJECTION, type UserForView } from '../users/user.views.js';
import { toGoogleProfile } from './auth.views.js';
import { deleteEmailTokens } from './email-token.service.js';
import { revokeAllSessions } from './session.service.js';
import { signIn } from './sign-in.service.js';

type GoogleDeps = Pick<AppDeps, 'env' | 'clock' | 'logger' | 'google' | 'redis' | 'keys'>;
type LinkCandidate = UserForView & Pick<UserDoc, 'googleSub' | 'emailVerifiedAt'>;

export async function signInWithGoogle(deps: GoogleDeps, idToken: string): Promise<GoogleAuthResponse> {
  const identity = await deps.google.verify(idToken);
  if (!identity) throw ApiError.invalidGoogleToken();

  const linked = await UserModel.findOne({ googleSub: identity.sub }, USER_VIEW_PROJECTION).lean<UserForView>();
  if (linked) return { status: 'signed_in', session: await signIn(deps, linked) };

  const byEmail = await UserModel.findOne({ email: identity.email }, { ...USER_VIEW_PROJECTION, googleSub: 1, emailVerifiedAt: 1 }).lean<LinkCandidate>();
  if (!byEmail) return { status: 'registration_required', profile: toGoogleProfile(identity) };
  if (byEmail.googleSub) throw ApiError.invalidGoogleToken('This email is linked to a different Google account');
  return { status: 'signed_in', session: await linkGoogleAccount(deps, byEmail, identity) };
}

async function linkGoogleAccount(deps: GoogleDeps, user: LinkCandidate, identity: GoogleIdentity): Promise<AuthSession> {
  const verified = Boolean(user.emailVerifiedAt);
  return withTransaction(deps.logger, async (tx) => {
    const update = verified
      ? { $set: { googleSub: identity.sub } }
      : { $set: { googleSub: identity.sub, emailVerifiedAt: deps.clock.now() }, $unset: { passwordHash: 1 } };
    // `null` also matches a missing field; a concurrent link of the same Google account is a no-op.
    const { matchedCount } = await UserModel.updateOne({ _id: user._id, googleSub: { $in: [null, identity.sub] } }, update, {
      session: tx.session,
    });
    if (matchedCount === 0) throw ApiError.invalidGoogleToken('This email is linked to a different Google account');
    if (!verified) {
      await revokeAllSessions(deps, user._id, tx);
      await deleteEmailTokens(user._id, 'verify_email', tx.session);
    }
    return signIn(deps, user, tx.session);
  });
}
