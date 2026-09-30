/** `GET`/`PATCH /professional/profile`: the signed-in professional's complete profile. */
import type { ClientSession, Types } from 'mongoose';

import type { AppDeps } from '../../deps.js';
import { withTransaction } from '../../infra/mongo.js';
import { ApiError } from '../../lib/errors.js';
import type { AuthContext } from '../../middleware/auth.js';
import type { OwnProfessionalProfile } from '../../shared/contract/index.js';
import { changeAvatar } from '../uploads/avatar.service.js';
import { UserModel, type UserDoc } from '../users/user.model.js';
import { ProfessionalModel, type ProfessionalDoc } from './professional.model.js';
import { invalidatePublicProfessionalProfile } from './professional-cache.js';
import { toOwnProfessionalProfile } from './professional.views.js';
import { accountChanges, professionalChanges } from './profile-changes.js';
import type { UpdateProfessionalProfileInput } from './professionals.schemas.js';

export type ProfileUser = Pick<UserDoc, '_id' | 'firstName' | 'lastName' | 'avatar' | 'notificationPreferences'>;
const PROFILE_USER_PROJECTION = { firstName: 1, lastName: 1, avatar: 1, notificationPreferences: 1 } as const;

export interface LoadedProfile {
  pro: ProfessionalDoc;
  user: ProfileUser;
}

/** The profile and the account fields it shows (same `_id`), or `null`. */
export async function loadProfessionalProfile(professionalId: Types.ObjectId): Promise<LoadedProfile | null> {
  const [pro, user] = await Promise.all([
    ProfessionalModel.findById(professionalId).lean<ProfessionalDoc>(),
    UserModel.findById(professionalId, PROFILE_USER_PROJECTION).lean<ProfileUser>(),
  ]);
  return pro && user ? { pro, user } : null;
}

export async function getOwnProfessionalProfile(auth: AuthContext): Promise<OwnProfessionalProfile> {
  const loaded = await loadProfessionalProfile(auth.userId);
  if (!loaded) throw ApiError.notFound('Professional profile');
  return toOwnProfessionalProfile(loaded.pro, loaded.user);
}

async function saveProfile(
  deps: Pick<AppDeps, 'clock'>,
  id: Types.ObjectId,
  input: UpdateProfessionalProfileInput,
  session?: ClientSession,
): Promise<LoadedProfile> {
  const account = accountChanges(input);
  if (input.avatarUrl !== undefined) {
    const current = await UserModel.findById(id, { avatar: 1 }, { session }).lean<Pick<UserDoc, 'avatar'>>();
    if (!current) throw ApiError.notFound('Professional profile');
    account.avatar = await changeAvatar(id, current.avatar, input.avatarUrl, deps.clock.now(), session);
  }
  const pro = await ProfessionalModel.findOneAndUpdate({ _id: id }, { $set: professionalChanges(id, input) }, { session, returnDocument: 'after' }).lean<ProfessionalDoc>();
  const user =
    Object.keys(account).length > 0
      ? await UserModel.findOneAndUpdate({ _id: id }, { $set: account }, { session, projection: PROFILE_USER_PROJECTION, returnDocument: 'after' }).lean<ProfileUser>()
      : await UserModel.findById(id, PROFILE_USER_PROJECTION, { session }).lean<ProfileUser>();
  if (!pro || !user) throw ApiError.notFound('Professional profile');
  return { pro, user };
}

export async function updateOwnProfessionalProfile(
  deps: Pick<AppDeps, 'clock' | 'logger' | 'cache' | 'realtime'>,
  auth: AuthContext,
  input: UpdateProfessionalProfileInput,
): Promise<OwnProfessionalProfile> {
  const id = auth.userId;
  // Profile and account change together only when the account is touched too (name, phone,
  // settings, avatar claim); a profile-only edit is a single-document write.
  const touchesAccount = input.avatarUrl !== undefined || Object.keys(accountChanges(input)).length > 0;
  const saved = touchesAccount
    ? await withTransaction(deps.logger, ({ session }) => saveProfile(deps, id, input, session))
    : await saveProfile(deps, id, input);
  await invalidatePublicProfessionalProfile(deps, id);
  await deps.realtime.publish([id.toHexString()], { type: 'profile.updated', professionalId: id.toHexString() });
  return toOwnProfessionalProfile(saved.pro, saved.user);
}
