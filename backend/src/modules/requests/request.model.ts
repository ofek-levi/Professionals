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

/** A photo, uploaded with the request (or a draft edit); `publicId` deletes it from storage. */
export interface RequestPhotoDoc {
  url: string;
  publicId: string;
}

export interface RequestDoc {
  _id: Types.ObjectId;
  /** Owner (`users._id`). */
  customer: Types.ObjectId;
  categoryId: CategoryId;
  description: string;
  /**
   * Exact location (professionals see `publicPoint` until hired); once its customer deleted their
   * account, the approximate pin marked `approximate` (`account-erasure.ts`).
   */
  location: LocationDoc;
  /**
   * The approximate pin professionals see (`approximateCoordinates(location, id)`), stored so that
   * every professional-facing view and geo query (matching, explorer, distances) uses it: no filter
   * or distance ever answers anything about the exact address, and the pin never moves unless the
   * location does. Kept in sync by `requestPublicPoint`.
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
  /**
   * Professionals the publication matched and notified (set by the publish fan-out right after
   * the response; `null` for drafts and until then). Shown to the customer only.
   */
  matchedProfessionalCount: number | null;
  /** The app's idempotency key of `POST /requests` (a retried post returns this request). */
  clientRequestId?: string;
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
        new Schema<RequestPhotoDoc>({ url: { type: String, required: true }, publicId: { type: String, required: true } }, { _id: false }),
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
    matchedProfessionalCount: { type: Number, default: null },
    clientRequestId: { type: String },
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
// Idempotent POST /requests: one request per (customer, clientRequestId), also under retries; the
// lookup that answers a retry runs first on every create. `$exists` (not `$type: 'string'`): MongoDB
// uses a partial index only when the query implies its filter, and an equality does not imply a type.
requestSchema.index(
  { customer: 1, clientRequestId: 1 },
  { unique: true, partialFilterExpression: { clientRequestId: { $exists: true } }, name: 'customer_clientRequestId' },
);
// Explorer + professional dashboard: $geoNear around a professional's center over requests that
// accept offers in their categories. Status/category lead so the geo scan never walks the
// (ever-growing) closed requests of the area.
requestSchema.index({ status: 1, categoryId: 1, publicPoint: '2dsphere' });

export const RequestModel = model<RequestDoc>('Request', requestSchema);
