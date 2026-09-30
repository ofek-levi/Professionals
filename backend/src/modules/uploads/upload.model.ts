/**
 * `uploads`: images uploaded by a user (request photos, avatars). An upload is "attached" once a
 * request or profile references it (`upload-attachments.service.ts`); unattached ones older than
 * 24 h are deleted by the daily `orphan-uploads` cron (Cloudinary + this document).
 */
import { Schema, model, type Types } from 'mongoose';

import { modelTimestamps } from '../../infra/model-clock.js';

export interface UploadDoc {
  _id: Types.ObjectId;
  owner: Types.ObjectId;
  /** Cloudinary public id (for deletion). */
  publicId: string;
  url: string;
  width: number | null;
  height: number | null;
  attachedAt: Date | null;
  createdAt: Date;
}

const uploadSchema = new Schema<UploadDoc>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    publicId: { type: String, required: true },
    url: { type: String, required: true },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    attachedAt: { type: Date, default: null },
  },
  { timestamps: modelTimestamps({ updatedAt: false }), versionKey: false },
);

/** Filter for "not attached yet": `$type` (unlike `null`, which also matches a missing field) bounds the partial index exactly. */
export const UNATTACHED = { $type: 'null' } as const;

// Orphan-uploads cron: unattached uploads older than the cutoff (oldest first).
uploadSchema.index({ attachedAt: 1, createdAt: 1 });
// Upload quota: the caller's unattached uploads (only those are in this small partial index).
uploadSchema.index({ owner: 1 }, { name: 'owner_unattached', partialFilterExpression: { attachedAt: UNATTACHED } });
// Avatar change: the `avatarUrl` a profile PATCH sends must be one of the caller's uploads.
uploadSchema.index({ owner: 1, url: 1 });

export const UploadModel = model<UploadDoc>('Upload', uploadSchema);
