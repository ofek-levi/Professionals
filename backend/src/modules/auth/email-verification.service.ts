/**
 * Email verification (not required to use the app). The link opens a confirmation page
 * (`verifyLinkAccount`, nothing changes); the page's button verifies (`verifyEmail`). A plain GET
 * must not verify: mail gateways prefetch links, and a verified address makes Google linking
 * trust the account (see `google-auth.service.ts`).
 */
import type { AppDeps } from '../../deps.js';
import type { AppLanguage } from '../../shared/domain.js';
import { UserModel } from '../users/user.model.js';
import { consumeEmailToken, findEmailTokenUser } from './email-token.service.js';

type LinkAccount = { email: string; language: AppLanguage };

/** The account of a valid, unused verify link (shown on the confirmation page), or `null`. */
export async function verifyLinkAccount(deps: Pick<AppDeps, 'clock'>, token: string): Promise<LinkAccount | null> {
  const userId = await findEmailTokenUser(token, 'verify_email', deps.clock.now());
  if (!userId) return null;
  return UserModel.findById(userId, { _id: 0, email: 1, language: 1 }).lean<LinkAccount>();
}

/** Uses the link up and marks the address verified; the account's language, or `null` for a bad link. */
export async function verifyEmail(deps: Pick<AppDeps, 'clock'>, token: string): Promise<{ language: AppLanguage } | null> {
  const now = deps.clock.now();
  const userId = await consumeEmailToken(token, 'verify_email', now);
  if (!userId) return null;
  // Keeps the first verification time (a Google link may have verified it already).
  await UserModel.updateOne({ _id: userId, emailVerifiedAt: null }, { $set: { emailVerifiedAt: now } });
  const user = await UserModel.findById(userId, { language: 1 }).lean();
  return user ? { language: user.language } : null;
}
