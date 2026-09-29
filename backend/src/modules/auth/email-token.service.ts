/**
 * Single-use tokens of the links sent by email. Issuing a token replaces the user's previous one
 * of the same purpose (only the newest link works); opening a link consumes it atomically.
 */
import type { ClientSession, Types } from 'mongoose';

import { randomToken, sha256 } from '../../lib/crypto.js';
import { API_LIMITS } from '../../shared/limits.js';
import { EmailTokenModel, type EmailTokenPurpose } from './email-token.model.js';

const TTL_MS: Record<EmailTokenPurpose, number> = {
  verify_email: API_LIMITS.emailVerificationTtlHours * 60 * 60_000,
  reset_password: API_LIMITS.passwordResetTtlMinutes * 60_000,
};

export async function issueEmailToken(userId: Types.ObjectId, purpose: EmailTokenPurpose, now: Date): Promise<string> {
  const token = randomToken();
  await EmailTokenModel.deleteMany({ user: userId, purpose });
  await EmailTokenModel.create({ user: userId, purpose, tokenHash: sha256(token), expiresAt: new Date(now.getTime() + TTL_MS[purpose]) });
  return token;
}

const liveFilter = (token: string, purpose: EmailTokenPurpose, now: Date) => ({
  tokenHash: sha256(token),
  purpose,
  expiresAt: { $gt: now },
});

/** The user of a valid, unused link (without using it up: showing the reset form). */
export async function findEmailTokenUser(token: string, purpose: EmailTokenPurpose, now: Date): Promise<Types.ObjectId | null> {
  const found = await EmailTokenModel.findOne(liveFilter(token, purpose, now), { user: 1 }).lean();
  return found?.user ?? null;
}

/** Uses the link up; `null` when it is unknown, expired or already used. */
export async function consumeEmailToken(
  token: string,
  purpose: EmailTokenPurpose,
  now: Date,
  session?: ClientSession,
): Promise<Types.ObjectId | null> {
  const found = await EmailTokenModel.findOneAndDelete(liveFilter(token, purpose, now), { projection: { user: 1 }, session }).lean();
  return found?.user ?? null;
}

export function deleteEmailTokens(userId: Types.ObjectId, purpose: EmailTokenPurpose, session?: ClientSession): Promise<unknown> {
  return EmailTokenModel.deleteMany({ user: userId, purpose }, { session });
}
