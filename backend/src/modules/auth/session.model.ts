/**
 * `sessions`: one per signed-in app install. Holds only the SHA-256 of the current refresh token
 * and of the one the last refresh rotated away (a replayed previous token = theft → the session
 * is deleted). Deleting the document revokes the session; MongoDB removes expired ones (TTL).
 */
import { Schema, model, type Types } from 'mongoose';

export interface SessionDoc {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  tokenHash: string;
  /** Hash of the token rotated away by the last refresh (reuse detection). */
  previousTokenHash?: string;
  /**
   * Sliding: set to now + 90 days on creation and on every refresh, so the time of the last
   * rotation is `expiresAt - 90 days` (no separate `lastUsedAt` needed).
   */
  expiresAt: Date;
}

const sessionSchema = new Schema<SessionDoc>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  tokenHash: { type: String, required: true },
  previousTokenHash: { type: String },
  expiresAt: { type: Date, required: true },
});

// POST /auth/refresh and /auth/logout look the session up by the presented token.
sessionSchema.index({ tokenHash: 1 }, { unique: true });
// Reuse detection (refresh) and logout with a token that was already rotated away.
sessionSchema.index({ previousTokenHash: 1 }, { partialFilterExpression: { previousTokenHash: { $type: 'string' } } });
// Revoke every session of a user (password reset, Google linking over an unverified password).
sessionSchema.index({ user: 1 });
// Expired sessions are deleted by MongoDB.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const SessionModel = model<SessionDoc>('Session', sessionSchema);
