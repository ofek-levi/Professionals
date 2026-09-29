/**
 * Request photos are the customer's own uploads (`POST /uploads/images`). Using one attaches it
 * (so the orphan cron keeps it); photos removed from a draft, or of a deleted draft, are released.
 */
import { Types, type ClientSession } from 'mongoose';

import { ApiError } from '../../lib/errors.js';
import { isObjectIdString, uniqueIds } from '../../lib/ids.js';
import { vm } from '../../shared/validation-messages.js';
import { claimUploads, releaseUploads } from '../uploads/upload-attachments.service.js';
import type { RequestPhotoDoc } from './request.model.js';

function photoNotFound(photoId: string): ApiError {
  return ApiError.validation({ photoIds: [vm('request.photoNotFound')] }, `Unknown photo "${photoId}"`);
}

/** Photo ids of the payload, de-duplicated (an id that is not ours cannot exist). */
function parsePhotoIds(photoIds: readonly string[]): Types.ObjectId[] {
  for (const id of photoIds) if (!isObjectIdString(id)) throw photoNotFound(id);
  return uniqueIds(photoIds.map((id) => new Types.ObjectId(id)));
}

/**
 * Resolves `photoIds` (in order) to photos: ones already on the request are kept, the others must be
 * the owner's unattached uploads and get attached. Unknown/foreign ids → 400 `photoIds`.
 */
export async function resolveRequestPhotos(
  owner: Types.ObjectId,
  photoIds: readonly string[],
  current: readonly RequestPhotoDoc[],
  now: Date,
  session: ClientSession,
): Promise<RequestPhotoDoc[]> {
  const ids = parsePhotoIds(photoIds);
  const kept = new Map(current.map((photo) => [photo.upload.toHexString(), photo]));
  const toClaim = ids.filter((id) => !kept.has(id.toHexString()));
  const claimed = await claimUploads(owner, toClaim, now, session);
  const byId = new Map<string, RequestPhotoDoc>(kept);
  for (const upload of claimed) byId.set(upload._id.toHexString(), { upload: upload._id, url: upload.url, width: upload.width, height: upload.height });
  return ids.map((id) => {
    const photo = byId.get(id.toHexString());
    if (!photo) throw photoNotFound(id.toHexString());
    return photo;
  });
}

/** Releases the photos of `before` that are not in `after`. */
export async function releaseRemovedPhotos(
  before: readonly RequestPhotoDoc[],
  after: readonly RequestPhotoDoc[],
  session: ClientSession,
): Promise<void> {
  const keep = new Set(after.map((photo) => photo.upload.toHexString()));
  await releaseUploads(before.map((photo) => photo.upload).filter((id) => !keep.has(id.toHexString())), session);
}
