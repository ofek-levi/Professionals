/** `offers`: a professional's price + appointment proposal for a request. */
import { Schema, model, type Types } from 'mongoose';

import { modelTimestamps } from '../../infra/model-clock.js';
import { SUPPORTED_CURRENCIES, type CurrencyCode } from '../../shared/domain.js';
import {
  ACTIVE_OFFER_STATUSES,
  OFFER_STATUS_REASONS,
  OFFER_STATUSES,
  type OfferStatus,
  type OfferStatusReason,
} from '../../shared/statuses.js';

export interface OfferDoc {
  _id: Types.ObjectId;
  request: Types.ObjectId;
  /** `professionals._id` (= the professional's user id). */
  professional: Types.ObjectId;
  price: number;
  currency: CurrencyCode;
  proposedStartAt: Date;
  estimatedDurationMinutes: number | null;
  message: string | null;
  status: OfferStatus;
  statusReason: OfferStatusReason | null;
  /** Pending offers expire at this time (offer-expiry cron). */
  expiresAt: Date;
  /** When the customer accepted/rejected it. */
  respondedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const offerSchema = new Schema<OfferDoc>(
  {
    request: { type: Schema.Types.ObjectId, ref: 'Request', required: true },
    professional: { type: Schema.Types.ObjectId, ref: 'Professional', required: true },
    price: { type: Number, required: true },
    currency: { type: String, enum: SUPPORTED_CURRENCIES, required: true },
    proposedStartAt: { type: Date, required: true },
    estimatedDurationMinutes: { type: Number, default: null },
    message: { type: String, default: null },
    status: { type: String, enum: OFFER_STATUSES, required: true },
    statusReason: { type: String, enum: [...OFFER_STATUS_REASONS, null], default: null },
    expiresAt: { type: Date, required: true },
    respondedAt: { type: Date, default: null },
  },
  { timestamps: modelTimestamps() },
);

// One active (pending/accepted) offer per professional and request, also under concurrency
// (duplicate key → 409 DUPLICATE_OFFER).
offerSchema.index(
  { request: 1, professional: 1 },
  { unique: true, partialFilterExpression: { status: { $in: [...ACTIVE_OFFER_STATUSES] } } },
);
// GET /requests/:id/offers, accept (reject the others), cancel cascade, counters, request views
// (per-request stats and "my offer" of a page of requests, `$in`), realtime audience.
offerSchema.index({ request: 1, createdAt: 1 });
// GET /professional/offers (keyset on updatedAt; `status: {$in}` always set so the planner merges
// the per-status ranges in index order), active-offer request ids, dashboard pending offers,
// response-time sample.
offerSchema.index({ professional: 1, status: 1, updatedAt: -1, _id: -1 });
// Offer-expiry cron: pending offers past expiresAt.
offerSchema.index({ expiresAt: 1 }, { partialFilterExpression: { status: 'pending' } });

export const OfferModel = model<OfferDoc>('Offer', offerSchema);
