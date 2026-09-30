/**
 * `sessions`: one per signed-in app install. Holds only the SHA-256 of the current refresh token
 * and of the one the last refresh rotated away (grace window for a concurrent refresh), plus the
 * install's Expo push token. Refresh tokens carry their session id (`refresh-token.ts`), so every
 * lookup is by `_id`. Deleting the document revokes the session (and stops its pushes); MongoDB
 * removes expired ones (TTL).
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
  /**
   * Expo push token of this install (`POST /me/devices`, `push-token.service.ts`); absent until the
   * app registers one. It goes away with the session (sign-out, revocation, expiry), and a token is
   * on at most one session: another account signing in on the same phone takes it over.
   */
  pushToken?: string;
}

const sessionSchema = new Schema<SessionDoc>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tokenHash: { type: String, required: true },
    previousTokenHash: { type: String },
    expiresAt: { type: Date, required: true },
    pushToken: { type: String },
  },
  { versionKey: false },
);

// Refresh and logout read the session by the id inside the token (`_id`, no extra index).
// Revoke every session of a user (password reset, Google linking) by the prefix; push fan-out
// reads the recipients' sessions that have a token.
sessionSchema.index({ user: 1, pushToken: 1 });
// One session per token: registration takes it from another session, DELETE /me/devices/:token,
// tokens Expo reports unregistered. `$exists` (not `$type`) so equality and `$in` lookups use it.
sessionSchema.index({ pushToken: 1 }, { unique: true, partialFilterExpression: { pushToken: { $exists: true } } });
// Expired sessions are deleted by MongoDB.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const SessionModel = model<SessionDoc>('Session', sessionSchema);
