/**
 * `sessions`: one per signed-in app install. Holds only the SHA-256 of the current refresh token
 * and of the one the last refresh rotated away (grace window for a concurrent refresh). Refresh
 * tokens carry their session id (`refresh-token.ts`), so every lookup is by `_id`. Deleting the
 * document revokes the session; MongoDB removes expired ones (TTL).
 */
import { Schema, model, type Types } from 'mongoose';

export interface SessionDoc {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  tokenHash: string;
  /** Hash of the token rotated away by the last refresh (a replay within the grace window is a concurrent refresh). */
  previousTokenHash?: string;
  /**
   * Sliding: set to now + 90 days on creation and on every refresh, so the time of the last
   * rotation is `expiresAt - 90 days` (no separate `lastUsedAt` needed).
   */
  expiresAt: Date;
}

const sessionSchema = new Schema<SessionDoc>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tokenHash: { type: String, required: true },
    previousTokenHash: { type: String },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false },
);

// Refresh and logout read the session by the id inside the token (`_id`, no extra index).
// Revoke every session of a user (password reset, Google linking).
sessionSchema.index({ user: 1 });
// Expired sessions are deleted by MongoDB.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const SessionModel = model<SessionDoc>('Session', sessionSchema);
