/**
 * `avatarUrl` of the profile PATCHes. The app uploads the photo first (`POST /uploads/images`) and
 * sends the returned URL; the server only accepts the caller's own, unattached upload, so a profile
 * can never make other users' apps load an arbitrary URL. The replaced image, when it was ours,
 * is released for the orphan-uploads cron.
 */
import type { ClientSession, Types } from 'mongoose';

import { ApiError } from '../../lib/errors.js';
import { vm } from '../../shared/validation-messages.js';
import type { AvatarDoc } from '../users/user.model.js';
import { claimUploadByUrl, releaseUploadByUrl } from './upload-attachments.service.js';

/** Returns the `avatar` value to store (`current` when the URL did not change). */
export async function changeAvatar(
  owner: Types.ObjectId,
  current: AvatarDoc | null,
  requestedUrl: string | null,
  now: Date,
  session?: ClientSession,
): Promise<AvatarDoc | null> {
  if (requestedUrl === (current?.url ?? null)) return current;
  let next: AvatarDoc | null = null;
  if (requestedUrl !== null) {
    const upload = await claimUploadByUrl(owner, requestedUrl, now, session);
    if (!upload) throw ApiError.validation({ avatarUrl: [vm('invalid')] }, 'The avatar must be an image uploaded with POST /uploads/images');
    next = { url: upload.url, publicId: upload.publicId };
  }
  // Google profile pictures (no publicId) are not ours to delete.
  if (current?.publicId) await releaseUploadByUrl(owner, current.url, session);
  return next;
}
