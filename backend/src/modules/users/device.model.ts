/**
 * `devices`: Expo push tokens of signed-in app installs (`POST /v1/me/devices`). The platform the
 * app sends is validated but not stored: Expo routes by token and nothing reads it.
 */
import { Schema, model, type Types } from 'mongoose';

export interface DeviceDoc {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  /**
   * The session that registered the token: signing out (or revoking the session) removes the
   * device, so a signed-out phone stops receiving the account's notifications. A session that ends
   * without that (TTL expiry, a sign-out the server never received) leaves the device behind: push
   * fan-out skips and deletes devices whose session is gone (`notifications.push.ts`).
   */
  session: Types.ObjectId;
  /** Expo push token; a token re-registered by another user moves to that user. */
  token: string;
}

const deviceSchema = new Schema<DeviceDoc>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    session: { type: Schema.Types.ObjectId, ref: 'Session', required: true },
    token: { type: String, required: true },
  },
  { versionKey: false },
);

// Upsert/reassign on registration, DELETE /me/devices/:token, DeviceNotRegistered cleanup.
deviceSchema.index({ token: 1 }, { unique: true });
// Push fan-out: every device of the recipient; revoke-all (password reset) removes them.
deviceSchema.index({ user: 1 });
// Logout / revoked session removes the devices it registered; fan-out checks them against `sessions`.
deviceSchema.index({ session: 1 });

export const DeviceModel = model<DeviceDoc>('Device', deviceSchema);
