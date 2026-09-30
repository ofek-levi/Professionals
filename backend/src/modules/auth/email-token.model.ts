/**
 * `emailTokens`: single-use links sent by email (verify address, reset password). Only the
 * SHA-256 of the token is stored; used or superseded tokens are deleted, expired ones by TTL.
 */
import { Schema, model, type Types } from 'mongoose';

const EMAIL_TOKEN_PURPOSES = ['verify_email', 'reset_password'] as const;
export type EmailTokenPurpose = (typeof EMAIL_TOKEN_PURPOSES)[number];

export interface EmailTokenDoc {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  purpose: EmailTokenPurpose;
  tokenHash: string;
  expiresAt: Date;
}

const emailTokenSchema = new Schema<EmailTokenDoc>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    purpose: { type: String, enum: EMAIL_TOKEN_PURPOSES, required: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false },
);

// Opening a link: GET /auth/verify-email, GET+POST /auth/reset-password.
emailTokenSchema.index({ tokenHash: 1 }, { unique: true });
// A new verify link replaces the previous one; a successful reset ends every reset link of the user.
emailTokenSchema.index({ user: 1, purpose: 1 });
emailTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const EmailTokenModel = model<EmailTokenDoc>('EmailToken', emailTokenSchema);
