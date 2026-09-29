/** `devices`: Expo push tokens of signed-in app installs (`POST /v1/me/devices`). */
import { Schema, model, type Types } from 'mongoose';

import { DEVICE_PLATFORMS, type DevicePlatform } from '../../shared/domain.js';

export interface DeviceDoc {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  /**
   * The session that registered the token: signing out (or revoking the session) removes the
   * device, so a signed-out phone stops receiving the account's notifications.
   */
  session: Types.ObjectId;
  /** Expo push token; a token re-registered by another user moves to that user. */
  token: string;
  platform: DevicePlatform;
}

const deviceSchema = new Schema<DeviceDoc>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  session: { type: Schema.Types.ObjectId, ref: 'Session', required: true },
  token: { type: String, required: true },
  platform: { type: String, enum: DEVICE_PLATFORMS, required: true },
});

// Upsert/reassign on registration, DELETE /me/devices/:token, DeviceNotRegistered cleanup.
deviceSchema.index({ token: 1 }, { unique: true });
// Push fan-out: every device of the recipient; revoke-all (password reset) removes them.
deviceSchema.index({ user: 1 });
// Logout / revoked session removes the devices it registered.
deviceSchema.index({ session: 1 });

export const DeviceModel = model<DeviceDoc>('Device', deviceSchema);
