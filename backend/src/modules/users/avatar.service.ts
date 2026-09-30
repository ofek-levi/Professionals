/**
 * `PUT`/`DELETE /me/avatar`: the avatar is uploaded on its own and stored on the account as
 * `{ url, publicId }`. The image it replaces is deleted from storage when it is ours (a Google
 * profile picture has no `publicId`). Each change is one write that returns the previous avatar,
 * so concurrent changes each delete the image they replaced and the last write wins.
 */
import type { AppDeps } from '../../deps.js';
import { discardImages, storeImages, type ImageTarget } from '../../infra/storage/store-images.js';
import type { AuthContext } from '../../middleware/auth.js';
import { MULTIPART_FIELDS } from '../../shared/multipart-fields.js';
import { announceProfileChange } from '../professionals/own-profile.service.js';
import { accountGone } from './me.service.js';
import { UserModel, type AvatarDoc, type UserDoc } from './user.model.js';

/** Where avatars are stored, and the multipart field of the image. */
export const AVATAR_IMAGE: ImageTarget = { folder: 'avatars', field: MULTIPART_FIELDS.avatar };

type AvatarDeps = Pick<AppDeps, 'storage' | 'logger' | 'redis' | 'keys' | 'background' | 'cache' | 'realtime'>;

async function replaceAvatar(deps: AvatarDeps, auth: AuthContext, avatar: AvatarDoc | null): Promise<void> {
  const before = await UserModel.findOneAndUpdate(
    { _id: auth.userId },
    { $set: { avatar } },
    { projection: { avatar: 1 }, returnDocument: 'before' },
  ).lean<Pick<UserDoc, 'avatar'>>();
  if (!before) throw accountGone();
  const replaced = before.avatar?.publicId;
  if (replaced && replaced !== avatar?.publicId) deps.background.run('discard-avatar', () => discardImages(deps, [replaced]));
  // A professional's avatar is on the (cached) public profile.
  if (auth.role === 'professional') await announceProfileChange(deps, auth.userId);
}

export async function setAvatar(deps: AvatarDeps, auth: AuthContext, file: Buffer): Promise<void> {
  const [image] = await storeImages(deps, auth.userId.toHexString(), [file], AVATAR_IMAGE);
  if (!image) throw new Error('The avatar was not stored');
  try {
    await replaceAvatar(deps, auth, { url: image.url, publicId: image.publicId });
  } catch (error) {
    await discardImages(deps, [image.publicId]);
    throw error;
  }
}

export function removeAvatar(deps: AvatarDeps, auth: AuthContext): Promise<void> {
  return replaceAvatar(deps, auth, null);
}
