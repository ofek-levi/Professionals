/**
 * Geographic helpers (ported from the app's `utils/geo.ts` + `request-matching.ts`): distances,
 * GeoJSON conversion and the deterministic privacy offset of approximate locations.
 */
import { createHmac } from 'node:crypto';

import type { GeoCoordinates, ServiceLocation } from '../shared/contract/index.js';

const EARTH_RADIUS_KM = 6371.0088;
/** Approximate locations are moved by a deterministic 250–450 m offset. */
const APPROXIMATE_MIN_OFFSET_M = 250;
const APPROXIMATE_MAX_OFFSET_M = 450;

/** GeoJSON point as stored in MongoDB (`[longitude, latitude]`). */
export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number];
}

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;

export function toGeoPoint(coords: GeoCoordinates): GeoPoint {
  return { type: 'Point', coordinates: [coords.longitude, coords.latitude] };
}

export function fromGeoPoint(point: GeoPoint): GeoCoordinates {
  return { latitude: point.coordinates[1], longitude: point.coordinates[0] };
}

export function haversineDistanceKm(from: GeoCoordinates, to: GeoCoordinates): number {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLng = toRadians(to.longitude - from.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 0.1 km precision (what the app shows). */
export function roundDistanceKm(distanceKm: number): number {
  return Math.round(distanceKm * 10) / 10;
}

/** Moves a point `meters` along `bearingDeg` (0 = north). */
export function offsetCoordinates(coords: GeoCoordinates, meters: number, bearingDeg: number): GeoCoordinates {
  const angular = meters / 1000 / EARTH_RADIUS_KM;
  const bearing = toRadians(bearingDeg);
  const lat1 = toRadians(coords.latitude);
  const lng1 = toRadians(coords.longitude);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing));
  const lng2 =
    lng1 + Math.atan2(Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1), Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2));
  return { latitude: toDegrees(lat2), longitude: ((toDegrees(lng2) + 540) % 360) - 180 };
}

/** `LOCATION_PRIVACY_SECRET`, installed once per process by `createApp` (like the model clock). */
let offsetKey: string | null = null;

export function setLocationPrivacySecret(secret: string): void {
  offsetKey = secret;
}

/**
 * Deterministic approximate point for `seed` (the record id: every viewer sees the same pin, and
 * editing the location again moves it by the same offset, so edits cannot be averaged out). The
 * offset comes from an HMAC of the id: the id is public, the key is not, so it cannot be undone.
 */
export function approximateCoordinates(coords: GeoCoordinates, seed: string): GeoCoordinates {
  if (offsetKey === null) throw new Error('LOCATION_PRIVACY_SECRET is not installed (setLocationPrivacySecret)');
  const digest = createHmac('sha256', offsetKey).update(`approximate-location:${seed}`).digest();
  const span = APPROXIMATE_MAX_OFFSET_M - APPROXIMATE_MIN_OFFSET_M;
  const meters = APPROXIMATE_MIN_OFFSET_M + (digest.readUInt32BE(0) % (span + 1));
  const bearing = digest.readUInt32BE(4) % 360;
  return offsetCoordinates(coords, meters, bearing);
}

/**
 * Privacy view of a location: its stored approximate point (`requests.publicPoint`,
 * `professionals.serviceArea.publicCenter`), no street address, no access details. Never derived
 * from the location again: an anonymised request's location already is its approximate point, so
 * a second offset (the same one: it depends on the id only) would give the exact point away, and
 * the stored points stay the same when the key changes.
 */
export function approximateLocation(location: Pick<ServiceLocation, 'city' | 'neighborhood'>, publicPoint: GeoPoint): ServiceLocation {
  return {
    coordinates: fromGeoPoint(publicPoint),
    addressLine: '',
    city: location.city,
    neighborhood: location.neighborhood,
    details: null,
    isApproximate: true,
  };
}
