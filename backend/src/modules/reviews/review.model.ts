/**
 * `reviews`: one per completed job, written by its customer. The reviewer's display name/avatar
 * are resolved from `users` when listing (always current).
 */
import { Schema, model, type Types } from 'mongoose';

import { modelTimestamps } from '../../infra/model-clock.js';
import { CATEGORY_IDS, type CategoryId } from '../../shared/catalog/index.js';
import { RATING_VALUES, type Rating } from '../../shared/domain.js';

export interface ReviewDoc {
  _id: Types.ObjectId;
  job: Types.ObjectId;
  /** `professionals._id` (= the professional's user id). */
  professional: Types.ObjectId;
  /** `users._id` of the reviewer. */
  customer: Types.ObjectId;
  categoryId: CategoryId;
  rating: Rating;
  comment: string | null;
  createdAt: Date;
}

const reviewSchema = new Schema<ReviewDoc>(
  {
    job: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
    professional: { type: Schema.Types.ObjectId, ref: 'Professional', required: true },
    customer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    categoryId: { type: String, enum: CATEGORY_IDS, required: true },
    rating: { type: Number, enum: RATING_VALUES, required: true },
    comment: { type: String, default: null },
  },
  { timestamps: modelTimestamps({ updatedAt: false }), versionKey: false },
);

// One review per job (a double submit fails on this key → 409).
reviewSchema.index({ job: 1 }, { unique: true });
// GET /professionals/:id/reviews (newest first, keyset), rating aggregate + breakdown.
reviewSchema.index({ professional: 1, createdAt: -1, _id: -1 });
// Account deletion: the reviews a customer wrote lose their comment.
reviewSchema.index({ customer: 1 });

export const ReviewModel = model<ReviewDoc>('Review', reviewSchema);
