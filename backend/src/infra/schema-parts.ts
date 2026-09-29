/**
 * Mongoose sub-schemas shared by several models (GeoJSON points, service locations) and the
 * converters between stored locations and the contract's `ServiceLocation`.
 */
import { Schema } from 'mongoose';

import { fromGeoPoint, toGeoPoint, type GeoPoint } from '../lib/geo.js';
import type { ServiceLocation } from '../shared/contract/index.js';

/** Stored form of a `ServiceLocation` (coordinates as a GeoJSON point for 2dsphere queries). */
export interface LocationDoc {
  point: GeoPoint;
  addressLine: string;
  city: string;
  neighborhood: string | null;
  details: string | null;
}

export const geoPointSchema = new Schema<GeoPoint>(
  {
    type: { type: String, enum: ['Point'], required: true },
    coordinates: { type: [Number], required: true },
  },
  { _id: false },
);

export const locationSchema = new Schema<LocationDoc>(
  {
    point: { type: geoPointSchema, required: true },
    addressLine: { type: String, required: true },
    city: { type: String, required: true },
    neighborhood: { type: String, default: null },
    details: { type: String, default: null },
  },
  { _id: false },
);

export function toLocationDoc(location: Omit<ServiceLocation, 'isApproximate'>): LocationDoc {
  return {
    point: toGeoPoint(location.coordinates),
    addressLine: location.addressLine,
    city: location.city,
    neighborhood: location.neighborhood,
    details: location.details,
  };
}

/** Exact location as stored (privacy views derive the approximate one with `approximateLocation`). */
export function toServiceLocation(doc: LocationDoc): ServiceLocation {
  return {
    coordinates: fromGeoPoint(doc.point),
    addressLine: doc.addressLine,
    city: doc.city,
    neighborhood: doc.neighborhood,
    details: doc.details,
    isApproximate: false,
  };
}
