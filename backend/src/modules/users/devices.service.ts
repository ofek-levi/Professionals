/**
 * Expo push tokens of the caller's app installs. A token identifies an install, not a person: when
 * another account signs in on the same phone its registration moves the token to that account.
 * The device remembers the registering session so signing out removes it (`auth/session.service`).
 */
import { Types } from 'mongoose';

import type { AppDeps } from '../../deps.js';
import { ApiError, isDuplicateKeyError } from '../../lib/errors.js';
import { isObjectIdString } from '../../lib/ids.js';
import type { AuthContext } from '../../middleware/auth.js';
import { vm } from '../../shared/validation-messages.js';
import type { RegisterDeviceInput } from './users.schemas.js';
import { DeviceModel } from './device.model.js';


export async function registerDevice(deps: Pick<AppDeps, 'push'>, auth: AuthContext, input: RegisterDeviceInput): Promise<void> {
  if (!deps.push.isValidToken(input.pushToken)) throw ApiError.validation({ pushToken: [vm('invalid')] }, 'Not an Expo push token');
  if (!isObjectIdString(auth.sessionId)) throw ApiError.unauthorized();
  const upsert = () =>
    DeviceModel.updateOne(
      { token: input.pushToken },
      { $set: { user: auth.userId, session: new Types.ObjectId(auth.sessionId), platform: input.platform } },
      { upsert: true },
    );
  try {
    await upsert();
  } catch (error) {
    // Two registrations of a new token raced on the unique index: the second one updates.
    if (!isDuplicateKeyError(error)) throw error;
    await upsert();
  }
}

/** Idempotent; only the caller's own devices can be removed. */
export async function removeDevice(auth: AuthContext, token: string): Promise<void> {
  await DeviceModel.deleteOne({ token, user: auth.userId });
}
