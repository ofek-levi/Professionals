/**
 * Upload lifecycle shared with the modules that use images (profiles for avatars, requests for
 * photos). An upload is attached to at most one thing: only unattached uploads can be claimed, so
 * releasing one (an avatar replaced, a photo removed from a draft) never breaks another reference.
 * A released upload is deleted by the `orphan-uploads` cron once it is older than 24 h.
 */
import type { ClientSession, Types } from 'mongoose';

import { uniqueIds } from '../../lib/ids.js';
import { UploadModel, type UploadDoc } from './upload.model.js';

export type ClaimedUpload = Pick<UploadDoc, '_id' | 'publicId' | 'url' | 'width' | 'height'>;

const CLAIMED_PROJECTION = { publicId: 1, url: 1, width: 1, height: 1 } as const;

/**
 * Attaches the owner's unattached uploads among `uploadIds` and returns them in the given order;
 * ids that are someone else's, missing or already attached are left out (callers turn a shortfall
 * into a field error).
 */
export async function claimUploads(
  owner: Types.ObjectId,
  uploadIds: readonly Types.ObjectId[],
  now: Date,
  session?: ClientSession,
): Promise<ClaimedUpload[]> {
  const ids = uniqueIds(uploadIds);
  if (ids.length === 0) return [];
  const filter = { _id: { $in: ids }, owner, attachedAt: null };
  const claimable = await UploadModel.find(filter, CLAIMED_PROJECTION, { session }).lean<ClaimedUpload[]>();
  if (claimable.length === 0) return [];
  await UploadModel.updateMany({ ...filter, _id: { $in: claimable.map((upload) => upload._id) } }, { $set: { attachedAt: now } }, { session });
  const byId = new Map(claimable.map((upload) => [upload._id.toHexString(), upload]));
  return ids.flatMap((id) => byId.get(id.toHexString()) ?? []);
}

/** Attaches the owner's unattached upload with this URL (the image a profile PATCH points at). */
export async function claimUploadByUrl(owner: Types.ObjectId, url: string, now: Date, session?: ClientSession): Promise<ClaimedUpload | null> {
  return UploadModel.findOneAndUpdate(
    { owner, url, attachedAt: null },
    { $set: { attachedAt: now } },
    { session, projection: CLAIMED_PROJECTION, returnDocument: 'after' },
  ).lean<ClaimedUpload>();
}

/** Detaches uploads that are no longer used (the cron deletes them later). */
export async function releaseUploads(uploadIds: readonly Types.ObjectId[], session?: ClientSession): Promise<void> {
  const ids = uniqueIds(uploadIds);
  if (ids.length > 0) await UploadModel.updateMany({ _id: { $in: ids } }, { $set: { attachedAt: null } }, { session });
}

export async function releaseUploadByUrl(owner: Types.ObjectId, url: string, session?: ClientSession): Promise<void> {
  await UploadModel.updateOne({ owner, url }, { $set: { attachedAt: null } }, { session });
}
