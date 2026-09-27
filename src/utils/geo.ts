/**
 * Pure geographic helpers (no platform APIs). Distances use the haversine formula on a spherical
 * Earth, which is accurate to well under 0.5% for the short distances a local marketplace cares about.
 */
import type { GeoCoordinates } from '@/types/domain';

export const EARTH_RADIUS_KM = 6371.0088;

/** Map viewport in the shape `react-native-maps` expects. */
export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

/** Initial map viewport: Tel Aviv-Yafo and its immediate surroundings. */
export const DEFAULT_MAP_REGION: MapRegion = {
  latitude: 32.0853,
  longitude: 34.7818,
  latitudeDelta: 0.16,
  longitudeDelta: 0.16,
};

/** Smallest delta used for computed regions so a single point is not zoomed in absurdly. */
const MIN_REGION_DELTA = 0.012;
const KM_PER_DEGREE_LATITUDE = 110.574;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;

export function isValidCoordinates(value: unknown): value is GeoCoordinates {
  if (!value || typeof value !== 'object') return false;
  const { latitude, longitude } = value as Partial<GeoCoordinates>;
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
  );
}

/** Great-circle distance between two points in kilometers. */
export function haversineDistanceKm(from: GeoCoordinates, to: GeoCoordinates): number {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLng = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Rounds a distance to 0.1 km (the precision shown in the UI). */
export function roundDistanceKm(distanceKm: number): number {
  return Math.round(distanceKm * 10) / 10;
}

export function isWithinRadiusKm(center: GeoCoordinates, point: GeoCoordinates, radiusKm: number): boolean {
  return haversineDistanceKm(center, point) <= radiusKm;
}

/**
 * Moves a point `meters` along the initial `bearingDeg` (0 = north, 90 = east).
 * Used to derive approximate (privacy preserving) locations.
 */
export function offsetCoordinates(coords: GeoCoordinates, meters: number, bearingDeg: number): GeoCoordinates {
  const angular = meters / 1000 / EARTH_RADIUS_KM;
  const bearing = toRadians(bearingDeg);
  const lat1 = toRadians(coords.latitude);
  const lng1 = toRadians(coords.longitude);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing));
  const lng2 =
    lng1 + Math.atan2(Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1), Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2));
  return {
    latitude: toDegrees(lat2),
    longitude: ((toDegrees(lng2) + 540) % 360) - 180,
  };
}

/**
 * Region that fits all coordinates. `padding` is a multiplier applied to the bounding box
 * (1 = tight fit, 1.4 = 40% breathing room for markers and overlays).
 */
export function regionForCoordinates(coords: readonly GeoCoordinates[], padding = 1.4): MapRegion {
  if (coords.length === 0) return DEFAULT_MAP_REGION;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const { latitude, longitude } of coords) {
    minLat = Math.min(minLat, latitude);
    maxLat = Math.max(maxLat, latitude);
    minLng = Math.min(minLng, longitude);
    maxLng = Math.max(maxLng, longitude);
  }
  const factor = Math.max(1, padding);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * factor, MIN_REGION_DELTA),
    longitudeDelta: Math.max((maxLng - minLng) * factor, MIN_REGION_DELTA),
  };
}

/** Region that shows a full circle of `radiusKm` around `center` (e.g. a service area). */
export function regionForRadius(center: GeoCoordinates, radiusKm: number): MapRegion {
  const diameterKm = Math.max(radiusKm, 0.5) * 2 * 1.15;
  const latitudeDelta = diameterKm / KM_PER_DEGREE_LATITUDE;
  const kmPerDegreeLongitude = 111.32 * Math.cos(toRadians(center.latitude));
  const longitudeDelta = diameterKm / Math.max(kmPerDegreeLongitude, 1e-6);
  return {
    latitude: center.latitude,
    longitude: center.longitude,
    latitudeDelta: Math.max(latitudeDelta, MIN_REGION_DELTA),
    longitudeDelta: Math.max(longitudeDelta, MIN_REGION_DELTA),
  };
}
