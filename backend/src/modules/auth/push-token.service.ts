/**
 * Expo push tokens, stored on the session of the app install that registered them
 * (`sessions.pushToken`): the token goes away with the session (sign-out, revocation, expiry), so a
 * signed-out phone never shows the account's notifications. A token identifies an install, not a
 * person: when another account signs in on the same phone, its registration takes the token over.
 * The unique index keeps every token on at most one session.
 */
import { Types } from 'mongoose';

import type { AppDeps } from '../../deps.js';
import { ApiError, isDuplicateKeyError } from '../../lib/errors.js';
import { isObjectIdString } from '../../lib/ids.js';
import type { AuthContext } from '../../middleware/auth.js';
import { vm } from '../../shared/validation-messages.js';
import { SessionModel } from './session.model.js';

/**
 * Registrations of one token by different sessions at the same time: a registration fails only
 * when another one completes in between its two writes, so each of up to this many racing sessions
 * succeeds (the last one to write keeps the token).
 */
const MOVE_ATTEMPTS = 3;

export interface PushTarget {
  user: Types.ObjectId;
  pushToken: string;
}

/** Takes the token from any other session, then gives it to `sessionId`; false if that session is gone. */
async function moveToken(sessionId: Types.ObjectId, userId: Types.ObjectId, pushToken: string): Promise<boolean> {
  await SessionModel.updateOne({ pushToken, _id: { $ne: sessionId } }, { $unset: { pushToken: 1 } });
  const { matchedCount } = await SessionModel.updateOne({ _id: sessionId, user: userId }, { $set: { pushToken } });
  return matchedCount > 0;
}

/** `POST /me/devices`: the token now reaches the caller's session (the one of the access token) only. */
export async function registerPushToken(deps: Pick<AppDeps, 'push'>, auth: AuthContext, pushToken: string): Promise<void> {
  if (!deps.push.isValidToken(pushToken)) throw ApiError.validation({ pushToken: [vm('invalid')] }, 'Not an Expo push token');
  if (!isObjectIdString(auth.sessionId)) throw ApiError.unauthorized();
  const sessionId = new Types.ObjectId(auth.sessionId);
  for (let attempt = 1; ; attempt += 1) {
    try {
      if (await moveToken(sessionId, auth.userId, pushToken)) return;
      throw ApiError.unauthorized('The session has ended, please sign in again');
    } catch (error) {
      if (!isDuplicateKeyError(error) || attempt >= MOVE_ATTEMPTS) throw error;
    }
  }
}

/** `DELETE /me/devices/:token`: idempotent; never touches another account's session. */
export async function removePushToken(auth: AuthContext, pushToken: string): Promise<void> {
  await SessionModel.updateOne({ pushToken, user: auth.userId }, { $unset: { pushToken: 1 } });
}

/** Push fan-out: the tokens of the recipients' live sessions. */
export async function pushTargetsOf(userIds: Types.ObjectId[], now: Date): Promise<PushTarget[]> {
  return SessionModel.find(
    { user: { $in: userIds }, pushToken: { $type: 'string' }, expiresAt: { $gt: now } },
    { _id: 0, user: 1, pushToken: 1 },
  ).lean<PushTarget[]>();
}

/** Tokens Expo reported unregistered (app uninstalled) or that are not Expo tokens; returns how many were removed. */
export async function forgetPushTokens(tokens: string[]): Promise<number> {
  if (tokens.length === 0) return 0;
  const { modifiedCount } = await SessionModel.updateMany({ pushToken: { $in: tokens } }, { $unset: { pushToken: 1 } });
  return modifiedCount;
}
