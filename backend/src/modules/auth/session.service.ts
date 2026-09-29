/**
 * Sessions: a 30-minute access token (JWT) plus an opaque 90-day refresh token that rotates on
 * every refresh. Only token hashes are stored. Presenting a refresh token that was already rotated
 * away means two parties hold the session (theft), so the whole session is revoked, unless it
 * happens within a few seconds of the rotation (the same app refreshing twice concurrently).
 */
import { Types, type ClientSession } from 'mongoose';

import type { AppDeps } from '../../deps.js';
import type { Tx } from '../../infra/mongo.js';
import { denySessions } from '../../infra/session-denylist.js';
import { signAccessToken } from '../../lib/access-token.js';
import { ApiError } from '../../lib/errors.js';
import { randomToken, sha256 } from '../../lib/crypto.js';
import { isObjectIdString } from '../../lib/ids.js';
import type { UserRole } from '../../shared/domain.js';
import type { RefreshResponse } from '../../shared/contract/index.js';
import { API_LIMITS } from '../../shared/limits.js';
import { DeviceModel } from '../users/device.model.js';
import { UserModel } from '../users/user.model.js';
import { SessionModel } from './session.model.js';

export const REFRESH_TOKEN_TTL_MS = API_LIMITS.refreshTokenTtlDays * 24 * 60 * 60_000;
/** A replay of the previous token this soon after its rotation is a concurrent refresh, not theft. */
export const REFRESH_REUSE_GRACE_MS = 30_000;

type SessionDeps = Pick<AppDeps, 'env' | 'clock'>;
type RevokeDeps = Pick<AppDeps, 'redis' | 'keys'>;

function issueAccessToken(deps: SessionDeps, user: { _id: Types.ObjectId; role: UserRole }, sessionId: Types.ObjectId) {
  const { token, expiresAt } = signAccessToken(
    deps.env.jwt,
    { userId: user._id.toHexString(), role: user.role, sessionId: sessionId.toHexString() },
    deps.clock,
  );
  return { accessToken: token, accessTokenExpiresAt: expiresAt.toISOString() };
}

/** Starts a session for `user` (inside the caller's transaction when `session` is given). */
export async function startSession(
  deps: SessionDeps,
  user: { _id: Types.ObjectId; role: UserRole },
  session?: ClientSession,
): Promise<RefreshResponse> {
  const refreshToken = randomToken();
  const expiresAt = new Date(deps.clock.now().getTime() + REFRESH_TOKEN_TTL_MS);
  const [created] = await SessionModel.create([{ user: user._id, tokenHash: sha256(refreshToken), expiresAt }], { session });
  if (!created) throw new Error('session was not created');
  return { ...issueAccessToken(deps, user, created._id), refreshToken };
}

/** `POST /auth/refresh`: rotates the refresh token and issues a new access token. */
export async function refreshSession(deps: SessionDeps & RevokeDeps & Pick<AppDeps, 'logger'>, refreshToken: string): Promise<RefreshResponse> {
  const now = deps.clock.now();
  const presentedHash = sha256(refreshToken);
  const nextToken = randomToken();
  const rotated = await SessionModel.findOneAndUpdate(
    { tokenHash: presentedHash, expiresAt: { $gt: now } },
    { $set: { tokenHash: sha256(nextToken), previousTokenHash: presentedHash, expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS) } },
    { projection: { user: 1 }, returnDocument: 'after' },
  ).lean();
  if (!rotated) {
    await detectReuse(deps, presentedHash, now);
    throw ApiError.unauthorized('The session has expired, please sign in again');
  }
  const user = await UserModel.findById(rotated.user, { role: 1 }).lean();
  if (!user) {
    await revokeSession(deps, rotated._id);
    throw ApiError.unauthorized('The account no longer exists');
  }
  return { ...issueAccessToken(deps, user, rotated._id), refreshToken: nextToken };
}

async function detectReuse(deps: RevokeDeps & Pick<AppDeps, 'logger'>, presentedHash: string, now: Date): Promise<void> {
  const reused = await SessionModel.findOne({ previousTokenHash: presentedHash }, { user: 1, expiresAt: 1 }).lean();
  if (!reused) return;
  const rotatedAt = reused.expiresAt.getTime() - REFRESH_TOKEN_TTL_MS;
  if (now.getTime() - rotatedAt < REFRESH_REUSE_GRACE_MS) return;
  await revokeSession(deps, reused._id);
  deps.logger.warn({ userId: reused.user.toHexString(), sessionId: reused._id.toHexString() }, 'refresh token reuse: session revoked');
}

/** Deletes a session and the push devices it registered; its access tokens stop working at once. */
export async function revokeSession(deps: RevokeDeps, sessionId: Types.ObjectId): Promise<void> {
  await SessionModel.deleteOne({ _id: sessionId });
  await DeviceModel.deleteMany({ session: sessionId });
  await denySessions(deps, [sessionId.toHexString()]);
}

/**
 * Signs the user out everywhere (password reset, Google linking over an unverified password).
 * The access tokens are refused once the transaction commits (listing them earlier would lock out
 * a session that survives an aborted transaction).
 */
export async function revokeAllSessions(deps: RevokeDeps, userId: Types.ObjectId, tx: Tx): Promise<void> {
  const sessions = await SessionModel.find({ user: userId }, { _id: 1 }, { session: tx.session }).lean();
  await SessionModel.deleteMany({ user: userId }, { session: tx.session });
  await DeviceModel.deleteMany({ user: userId }, { session: tx.session });
  const sessionIds = sessions.map((found) => found._id.toHexString());
  tx.afterCommit(() => denySessions(deps, sessionIds));
}

/**
 * `POST /auth/logout`: revokes the session of the refresh token (current or just rotated away) or,
 * without one, of the caller's access token. Idempotent.
 */
export async function logout(deps: RevokeDeps, input: { refreshToken?: string | undefined; bearerSessionId: string | null }): Promise<void> {
  if (input.refreshToken) {
    const hash = sha256(input.refreshToken);
    const found = await SessionModel.findOne({ $or: [{ tokenHash: hash }, { previousTokenHash: hash }] }, { _id: 1 }).lean();
    if (found) await revokeSession(deps, found._id);
    return;
  }
  // The bearer token is signature-verified, so its session id is authentic.
  if (input.bearerSessionId && isObjectIdString(input.bearerSessionId)) await revokeSession(deps, new Types.ObjectId(input.bearerSessionId));
}
