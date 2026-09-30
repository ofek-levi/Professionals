/**
 * `requests`: a customer's service request and its marketplace status. Offer counters are
 * denormalized because the professional explorer filters and sorts on them (hot path); they are
 * updated in the same transaction as the offer change.
 */
import { Schema, model, type Types } from 'mongoose';

import { modelTimestamps } from '../../infra/model-clock.js';
import { geoPointSchema, locationSchema, type LocationDoc } from '../../infra/schema-parts.js';
import { approximateCoordinates, fromGeoPoint, toGeoPoint, type GeoPoint } from '../../lib/geo.js';
import { CATEGORY_IDS, type CategoryId } from '../../shared/catalog/index.js';
import {
  PREFERRED_TIME_WINDOWS,
  REQUEST_CANCELLATION_REASONS,
  type PreferredTimeWindow,
  type RequestCancellationReason,
} from '../../shared/domain.js';
import { REQUEST_STATUSES, type RequestStatus } from '../../shared/statuses.js';
import { URGENCY_LEVELS, type UrgencyLevel } from '../../shared/urgency.js';

export interface RequestPhotoDoc {
  /** The `uploads` document (the photo id the app sees). */
  upload: Types.ObjectId;
  url: string;
  width: number | null;
  height: number | null;
}

export interface RequestDoc {
  _id: Types.ObjectId;
  /** Owner (`users._id`). */
  customer: Types.ObjectId;
  categoryId: CategoryId;
  description: string;
  /** Exact location; professionals get `approximateLocation(…, requestId)` until hired. */
  location: LocationDoc;
  /**
   * The approximate pin professionals see (`approximateCoordinates(location, id)`), stored so that
   * every professional-facing geo query (matching, explorer, distances) runs on it: no filter or
   * distance ever answers anything about the exact address. Kept in sync by `requestPublicPoint`.
   */
  publicPoint: GeoPoint;
  urgency: UrgencyLevel;
  preferredSchedule: { date: string; timeWindow: PreferredTimeWindow } | null;
  photos: RequestPhotoDoc[];
  notes: string | null;
  status: RequestStatus;
  /** Offers not withdrawn (includes rejected/expired). */
  offerCount: number;
  /** Offers awaiting the customer's decision. */
  pendingOfferCount: number;
  acceptedOffer: Types.ObjectId | null;
  job: Types.ObjectId | null;
  publishedAt: Date | null;
  cancelledAt: Date | null;
  cancellationReason: RequestCancellationReason | null;
  cancellationComment: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const requestSchema = new Schema<RequestDoc>(
  {
    customer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    categoryId: { type: String, enum: CATEGORY_IDS, required: true },
    description: { type: String, required: true },
    location: { type: locationSchema, required: true },
    publicPoint: { type: geoPointSchema, required: true },
    urgency: { type: String, enum: URGENCY_LEVELS, required: true },
    preferredSchedule: {
      type: new Schema(
        { date: { type: String, required: true }, timeWindow: { type: String, enum: PREFERRED_TIME_WINDOWS, required: true } },
        { _id: false },
      ),
      default: null,
    },
    photos: {
      type: [
        new Schema<RequestPhotoDoc>(
          {
            upload: { type: Schema.Types.ObjectId, ref: 'Upload', required: true },
            url: { type: String, required: true },
            width: { type: Number, default: null },
            height: { type: Number, default: null },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    notes: { type: String, default: null },
    status: { type: String, enum: REQUEST_STATUSES, required: true },
    offerCount: { type: Number, default: 0 },
    pendingOfferCount: { type: Number, default: 0 },
    acceptedOffer: { type: Schema.Types.ObjectId, ref: 'Offer', default: null },
    job: { type: Schema.Types.ObjectId, ref: 'Job', default: null },
    publishedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancellationReason: { type: String, enum: [...REQUEST_CANCELLATION_REASONS, null], default: null },
    cancellationComment: { type: String, default: null },
  },
  { timestamps: modelTimestamps(), versionKey: false },
);

/** The approximate pin of `location` for request `id`. */
export function requestPublicPoint(location: LocationDoc, id: Types.ObjectId): GeoPoint {
  return toGeoPoint(approximateCoordinates(fromGeoPoint(location.point), id.toHexString()));
}

// Every created or re-located request document gets its pin (updates through `$set` call
// `requestPublicPoint` themselves).
requestSchema.pre('validate', function setPublicPoint() {
  if (this.isNew || this.isModified('location')) this.publicPoint = requestPublicPoint(this.location, this._id);
});

// GET /customer/requests (newest update first, keyset), customer dashboard recent list.
requestSchema.index({ customer: 1, updatedAt: -1, _id: -1 });
// Customer dashboard counters by status.
requestSchema.index({ customer: 1, status: 1 });
// Explorer + professional dashboard: $geoNear around a professional's center over requests that
// accept offers in their categories. Status/category lead so the geo scan never walks the
// (ever-growing) closed requests of the area.
requestSchema.index({ status: 1, categoryId: 1, publicPoint: '2dsphere' });

export const RequestModel = model<RequestDoc>('Request', requestSchema);
