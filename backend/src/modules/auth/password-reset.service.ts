/**
 * Password reset: `POST /auth/password-reset` emails a single-use, 1-hour link to the reset page;
 * submitting a new password there replaces the hash and signs the account out everywhere.
 */
import type { AppDeps } from '../../deps.js';
import { withTransaction } from '../../infra/mongo.js';
import { ApiError } from '../../lib/errors.js';
import type { AppLanguage } from '../../shared/domain.js';
import { vm } from '../../shared/validation-messages.js';
import { UserModel } from '../users/user.model.js';
import { MAIL_RECIPIENT_PROJECTION, sendPasswordResetEmail, type MailRecipient } from './auth-mail.service.js';
import type { ResetPasswordInput } from './auth.schemas.js';
import { consumeEmailToken, findEmailTokenUser } from './email-token.service.js';
import { assertPasswordNotBreached } from './password-rules.js';
import { hashPassword } from './passwords.js';
import { revokeAllSessions } from './session.service.js';

type ResetDeps = Pick<AppDeps, 'env' | 'clock' | 'logger' | 'mailer' | 'background' | 'redis' | 'keys' | 'passwordBreach'>;

export function invalidResetLink(): ApiError {
  return ApiError.validation({ token: [vm('invalid')] }, 'The reset link is invalid or has expired');
}

/**
 * Always "succeeds" at once: the lookup and the email run in the background so neither the answer
 * nor its timing reveals whether the address has an account. Google-only accounts get a link too
 * (that is how they set a password).
 */
export function requestPasswordReset(deps: ResetDeps, email: string): void {
  deps.background.run('password-reset-email', async () => {
    const user = await UserModel.findOne({ email }, MAIL_RECIPIENT_PROJECTION).lean<MailRecipient>();
    if (user) await sendPasswordResetEmail(deps, user);
  });
}

/** The account a valid reset link belongs to (shown on the reset page), or `null`. */
export async function resetLinkAccount(deps: Pick<AppDeps, 'clock'>, token: string): Promise<{ email: string; language: AppLanguage } | null> {
  const userId = await findEmailTokenUser(token, 'reset_password', deps.clock.now());
  if (!userId) return null;
  return UserModel.findById(userId, { _id: 0, email: 1, language: 1 }).lean<{ email: string; language: AppLanguage }>();
}

/**
 * Sets the new password. Opening the emailed link proves the mailbox, so the address becomes
 * verified too. Every session (and its push devices) is revoked.
 */
export async function resetPassword(deps: ResetDeps, input: ResetPasswordInput): Promise<void> {
  const now = deps.clock.now();
  if (!(await findEmailTokenUser(input.token, 'reset_password', now))) throw invalidResetLink();
  await assertPasswordNotBreached(deps, input.password);
  const passwordHash = await hashPassword(input.password);
  await withTransaction(deps.logger, async (tx) => {
    const userId = await consumeEmailToken(input.token, 'reset_password', now, tx.session);
    if (!userId) throw invalidResetLink();
    await UserModel.updateOne({ _id: userId }, { $set: { passwordHash } }, { session: tx.session });
    await UserModel.updateOne({ _id: userId, emailVerifiedAt: null }, { $set: { emailVerifiedAt: now } }, { session: tx.session });
    await revokeAllSessions(deps, userId, tx);
  });
}
