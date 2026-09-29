/** `GET /auth/verify-email?token=`: marks the address verified (not required to use the app). */
import type { AppDeps } from '../../deps.js';
import type { AppLanguage } from '../../shared/domain.js';
import { UserModel } from '../users/user.model.js';
import { consumeEmailToken } from './email-token.service.js';

/** The language of the verified account, or `null` for an unknown, expired or used link. */
export async function verifyEmail(deps: Pick<AppDeps, 'clock'>, token: string): Promise<{ language: AppLanguage } | null> {
  const now = deps.clock.now();
  const userId = await consumeEmailToken(token, 'verify_email', now);
  if (!userId) return null;
  // Keeps the first verification time (a Google link may have verified it already).
  await UserModel.updateOne({ _id: userId, emailVerifiedAt: null }, { $set: { emailVerifiedAt: now } });
  const user = await UserModel.findById(userId, { language: 1 }).lean();
  return user ? { language: user.language } : null;
}
