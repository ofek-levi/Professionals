/**
 * Sessions: a 30-minute access token (JWT) plus an opaque 90-day refresh token that rotates on
 * every refresh. Only token hashes are stored. Refresh tokens name their session and are signed
 * (`refresh-token.ts`), so presenting any earlier token of a live session is recognised as a
 * replay (two parties hold the session: theft) and revokes it. The one exception is the token the
 * last refresh rotated away, within a few seconds of that rotation: the same app refreshing twice
 * concurrently, or retrying after a lost response. It gets the same successor token again.
 *
 * Races: rotation is one conditional update on the session document, so two refreshes with the
 * same token can never both rotate (the loser takes the grace path above); a revocation deletes
 * the document, after which no rotation matches, and lists the session id on the denylist for
 * longer than any access token issued before it can live.
 */
import { Types, type ClientSession } from 'mongoose';

import type { AppDeps } from '../../deps.js';
import type { Tx } from '../../infra/mongo.js';
import { denySessions } from '../../infra/session-denylist.js';
import { signAccessToken } from '../../lib/access-token.js';
import { ApiError } from '../../lib/errors.js';
import { sha256 } from '../../lib/crypto.js';
import { isObjectIdString } from '../../lib/ids.js';
import type { UserRole } from '../../shared/domain.js';
import type { RefreshResponse } from '../../shared/contract/index.js';
import { API_LIMITS } from '../../shared/limits.js';
import { DeviceModel } from '../users/device.model.js';
import { UserModel } from '../users/user.model.js';
import { mintRefreshToken, parseRefreshToken, refreshTokenKey, successorToken, type ParsedRefreshToken } from './refresh-token.js';
import { SessionModel } from './session.model.js';

const REFRESH_TOKEN_TTL_MS = API_LIMITS.refreshTokenTtlDays * 24 * 60 * 60_000;
/** A replay of the previous token this soon after its rotation is a concurrent refresh, not theft. */
const REFRESH_REUSE_GRACE_MS = 30_000;

type SessionDeps = Pick<AppDeps, 'env' | 'clock'>;
type RevokeDeps = Pick<AppDeps, 'redis' | 'keys'>;
type RefreshDeps = SessionDeps & RevokeDeps & Pick<AppDeps, 'logger'>;

function issueAccessToken(deps: SessionDeps, user: { _id: Types.ObjectId; role: UserRole }, sessionId: Types.ObjectId) {
  const { token, expiresAt } = signAccessToken(
    deps.env.jwt,
    { userId: user._id.toHexString(), role: user.role, sessionId: sessionId.toHexString() },
    deps.clock,
  );
  return { accessToken: token, accessTokenExpiresAt: expiresAt.toISOString() };
}

const keyOf = (deps: Pick<AppDeps, 'env'>) => refreshTokenKey(deps.env.jwt.accessSecret);

/** Starts a session for `user` (inside the caller's transaction when `session` is given). */
export async function startSession(
  deps: SessionDeps,
  user: { _id: Types.ObjectId; role: UserRole },
  session?: ClientSession,
): Promise<RefreshResponse> {
  const sessionId = new Types.ObjectId();
  const refreshToken = mintRefreshToken(keyOf(deps), sessionId);
  const expiresAt = new Date(deps.clock.now().getTime() + REFRESH_TOKEN_TTL_MS);
  await SessionModel.create([{ _id: sessionId, user: user._id, tokenHash: sha256(refreshToken), expiresAt }], { session });
  return { ...issueAccessToken(deps, user, sessionId), refreshToken };
}

/** `POST /auth/refresh`: rotates the refresh token and issues a new access token. */
export async function refreshSession(deps: RefreshDeps, refreshToken: string): Promise<RefreshResponse> {
  const key = keyOf(deps);
  const presented = parseRefreshToken(key, refreshToken);
  if (!presented) throw ApiError.unauthorized('The session has expired, please sign in again');
  const now = deps.clock.now();
  const presentedHash = sha256(refreshToken);
  const nextToken = successorToken(key, refreshToken, presented.sessionId);
  const nextHash = sha256(nextToken);

  const rotated = await SessionModel.findOneAndUpdate(
    { _id: presented.sessionId, tokenHash: presentedHash, expiresAt: { $gt: now } },
    { $set: { tokenHash: nextHash, previousTokenHash: presentedHash, expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS) } },
    { projection: { user: 1 }, returnDocument: 'after' },
  ).lean();
  const userId = rotated?.user ?? (await concurrentRefreshUser(deps, presented, { presentedHash, nextHash, now }));

  const user = await UserModel.findById(userId, { role: 1 }).lean();
  if (!user) {
    await revokeSession(deps, presented.sessionId);
    throw ApiError.unauthorized('The account no longer exists');
  }
  return { ...issueAccessToken(deps, user, presented.sessionId), refreshToken: nextToken };
}

/**
 * The token did not match the session's current one. Within the grace window after its own
 * rotation it is answered again (same successor, nothing written); an earlier token of this
 * session is a replay and revokes it; anything else is refused.
 */
async function concurrentRefreshUser(
  deps: RefreshDeps,
  presented: ParsedRefreshToken,
  { presentedHash, nextHash, now }: { presentedHash: string; nextHash: string; now: Date },
): Promise<Types.ObjectId> {
  const session = await SessionModel.findOne(
    { _id: presented.sessionId, expiresAt: { $gt: now } },
    { user: 1, tokenHash: 1, previousTokenHash: 1, expiresAt: 1 },
  ).lean();
  if (!session) throw ApiError.unauthorized('The session has expired, please sign in again');
  const rotatedAt = session.expiresAt.getTime() - REFRESH_TOKEN_TTL_MS;
  const justRotated = session.previousTokenHash === presentedHash && session.tokenHash === nextHash;
  if (justRotated && now.getTime() - rotatedAt < REFRESH_REUSE_GRACE_MS) return session.user;
  if (presented.authentic) {
    await revokeSession(deps, session._id);
    deps.logger.warn({ userId: session.user.toHexString(), sessionId: session._id.toHexString() }, 'refresh token reuse: session revoked');
  }
  throw ApiError.unauthorized('The session has expired, please sign in again');
}

/** Deletes a session and the push devices it registered; its access tokens stop working at once. */
async function revokeSession(deps: RevokeDeps, sessionId: Types.ObjectId): Promise<void> {
  await SessionModel.deleteOne({ _id: sessionId });
  await DeviceModel.deleteMany({ session: sessionId });
  await denySessions(deps, [sessionId.toHexString()]);
}

/**
 * Signs the user out everywhere (password reset, Google linking). The access tokens are refused
 * once the transaction commits (listing them earlier would lock out a session that survives an
 * aborted transaction).
 */
export async function revokeAllSessions(deps: RevokeDeps, userId: Types.ObjectId, tx: Tx): Promise<void> {
  const sessions = await SessionModel.find({ user: userId }, { _id: 1 }, { session: tx.session }).lean();
  await SessionModel.deleteMany({ user: userId }, { session: tx.session });
  await DeviceModel.deleteMany({ user: userId }, { session: tx.session });
  const sessionIds = sessions.map((found) => found._id.toHexString());
  tx.afterCommit(() => denySessions(deps, sessionIds));
}

/**
 * `POST /auth/logout`: revokes the session of the refresh token (any token this server issued for
 * it) or, without one, of the caller's access token. Idempotent.
 */
export async function logout(
  deps: RevokeDeps & Pick<AppDeps, 'env'>,
  input: { refreshToken?: string | undefined; bearerSessionId: string | null },
): Promise<void> {
  if (input.refreshToken) {
    const presented = parseRefreshToken(keyOf(deps), input.refreshToken);
    if (!presented) return;
    if (presented.authentic) {
      await revokeSession(deps, presented.sessionId);
      return;
    }
    // Signed with an earlier secret: only the current or the just-rotated token ends the session.
    const hash = sha256(input.refreshToken);
    const found = await SessionModel.exists({ _id: presented.sessionId, $or: [{ tokenHash: hash }, { previousTokenHash: hash }] });
    if (found) await revokeSession(deps, presented.sessionId);
    return;
  }
  // The bearer token is signature-verified, so its session id is authentic.
  if (input.bearerSessionId && isObjectIdString(input.bearerSessionId)) await revokeSession(deps, new Types.ObjectId(input.bearerSessionId));
}
