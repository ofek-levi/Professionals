/**
 * The operator's change of an account's sign-in email, on the holder's request (the Terms and the
 * Privacy Policy offer it by email; `src/change-email.ts`, OPERATIONS.md §9). The new address is
 * checked and lower-cased as at sign-up and must be free (the unique index decides a race). The
 * account is no longer verified: every email link sent to the old address goes, and a verification
 * link goes to the new one. A professional's contact email (shown to the customers who hire them)
 * follows when it still is the old sign-in address. Sessions stay (the holder asked; they stay
 * signed in), and so does a Google link: Google sign-in finds the account by the Google account,
 * whatever its address.
 */
import type { Types } from 'mongoose';

import type { AppDeps } from '../../deps.js';
import { withTransaction } from '../../infra/mongo.js';
import { isDuplicateKeyError } from '../../lib/errors.js';
import type { UserRole } from '../../shared/domain.js';
import { authEmailSchema } from '../auth/auth-fields.schemas.js';
import { MAIL_RECIPIENT_PROJECTION, sendVerificationEmail, type MailRecipient } from '../auth/auth-mail.service.js';
import { EmailTokenModel } from '../auth/email-token.model.js';
import { ProfessionalModel } from '../professionals/professional.model.js';
import { findActiveAccount } from './account-lookup.js';
import { NOT_DELETED, UserModel, type UserDoc } from './user.model.js';

export type SignInEmailChange =
  | { status: 'changed'; userId: Types.ObjectId; role: UserRole; contactEmailChanged: boolean; linkedToGoogle: boolean }
  /** No account (not deleted) has the current email or id. */
  | { status: 'no_account' }
  | { status: 'invalid_email' }
  | { status: 'unchanged' }
  /** Another account signs in with the new address. */
  | { status: 'email_taken' };

type ChangingUser = MailRecipient & Pick<UserDoc, 'role' | 'googleSub'>;

export async function changeSignInEmail(
  deps: Pick<AppDeps, 'env' | 'clock' | 'mailer' | 'logger'>,
  current: string,
  next: string,
): Promise<SignInEmailChange> {
  const parsed = authEmailSchema.safeParse(next);
  if (!parsed.success) return { status: 'invalid_email' };
  const email = parsed.data;
  const user = await findActiveAccount<ChangingUser>(current, { ...MAIL_RECIPIENT_PROJECTION, role: 1, googleSub: 1 });
  if (!user) return { status: 'no_account' };
  if (user.email === email) return { status: 'unchanged' };
  if (await UserModel.exists({ email })) return { status: 'email_taken' };

  let contactEmailChanged: boolean | null;
  try {
    contactEmailChanged = await withTransaction(deps.logger, async ({ session }) => {
      // Conditional: a deletion or another change since the read wins.
      const changed = await UserModel.updateOne(
        { _id: user._id, email: user.email, ...NOT_DELETED },
        { $set: { email }, $unset: { emailVerifiedAt: 1 } },
        { session },
      );
      if (changed.matchedCount === 0) return null;
      await EmailTokenModel.deleteMany({ user: user._id }, { session });
      if (user.role !== 'professional') return false;
      const contact = await ProfessionalModel.updateOne({ _id: user._id, 'contact.email': user.email }, { $set: { 'contact.email': email } }, { session });
      return contact.modifiedCount > 0;
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) return { status: 'email_taken' };
    throw error;
  }
  if (contactEmailChanged === null) return { status: 'no_account' };
  await sendVerificationEmail(deps, { ...user, email });
  return { status: 'changed', userId: user._id, role: user.role, contactEmailChanged, linkedToGoogle: user.googleSub !== undefined };
}
