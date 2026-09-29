/**
 * Geographic helpers (ported from the app's `utils/geo.ts` + `request-matching.ts`): distances,
 * GeoJSON conversion and the deterministic privacy offset of approximate locations.
 */
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

/** FNV-1a 32-bit hash (same as the app's `hashString`). */
export function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Deterministic approximate point for `seed` (e.g. the request id: every viewer sees the same pin). */
export function approximateCoordinates(coords: GeoCoordinates, seed: string): GeoCoordinates {
  const span = APPROXIMATE_MAX_OFFSET_M - APPROXIMATE_MIN_OFFSET_M;
  const meters = APPROXIMATE_MIN_OFFSET_M + (hashString(seed) % (span + 1));
  const bearing = hashString(`${seed}:bearing`) % 360;
  return offsetCoordinates(coords, meters, bearing);
}

/** Privacy view of a location: approximate point, no street address, no access details. */
export function approximateLocation(location: ServiceLocation, seed: string): ServiceLocation {
  return {
    coordinates: approximateCoordinates(location.coordinates, seed),
    addressLine: '',
    city: location.city,
    neighborhood: location.neighborhood,
    details: null,
    isApproximate: true,
  };
}
