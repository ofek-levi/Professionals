/**
 * Deleting an account needs proof that its holder is at the device, not only a signed-in app (an
 * unlocked phone left somewhere): the password, or a fresh Google sign-in of the linked Google
 * account (the only proof a Google-only account has). Refusals are 400 `VALIDATION_ERROR`, never
 * 401: the app treats a 401 as an expired access token and refreshes. A wrong password counts
 * towards the sign-in throttle, so this route cannot be used to guess passwords either.
 */
import type { AppDeps } from '../../deps.js';
import { ApiError } from '../../lib/errors.js';
import { vm } from '../../shared/validation-messages.js';
import { assertLoginAllowed, recordLoginFailure } from '../auth/login-throttle.js';
import { verifyPassword } from '../auth/passwords.js';
import type { UserDoc } from './user.model.js';
import type { DeleteAccountInput } from './users.schemas.js';

type ReauthDeps = Pick<AppDeps, 'env' | 'redis' | 'keys' | 'logger' | 'google'>;
export type ReauthUser = Pick<UserDoc, 'email' | 'passwordHash' | 'googleSub'>;

async function checkPassword(deps: ReauthDeps, user: ReauthUser & { passwordHash: string }, password: string, clientIp: string): Promise<void> {
  const attempt = { email: user.email, ip: clientIp };
  await assertLoginAllowed(deps, attempt);
  if (await verifyPassword(user.passwordHash, password)) return;
  await recordLoginFailure(deps, attempt);
  throw ApiError.validation({ password: [vm('auth.passwordIncorrect')] }, 'The password is incorrect');
}

async function checkGoogle(deps: ReauthDeps, googleSub: string, idToken: string): Promise<void> {
  const identity = await deps.google.verify(idToken);
  if (identity?.sub === googleSub) return;
  throw ApiError.validation({ googleIdToken: [vm('invalid')] }, 'Confirm with the Google account linked to this account');
}

/** Password accounts: `password` (or a token of their linked Google account); Google-only accounts: `googleIdToken`. */
export async function reauthenticate(deps: ReauthDeps, user: ReauthUser, input: DeleteAccountInput, clientIp: string): Promise<void> {
  const { passwordHash, googleSub } = user;
  if (passwordHash && input.password !== undefined) return checkPassword(deps, { ...user, passwordHash }, input.password, clientIp);
  if (googleSub && input.googleIdToken !== undefined) return checkGoogle(deps, googleSub, input.googleIdToken);
  throw passwordHash
    ? ApiError.validation({ password: [vm('auth.passwordRequired')] }, 'Enter your password to delete the account')
    : ApiError.validation({ googleIdToken: [vm('required')] }, 'Confirm with Google to delete the account');
}
