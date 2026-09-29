/**
 * Conversions between the app's `MapRegion` (center + latitude/longitude deltas, the shape the rest
 * of the app uses) and Leaflet bounds literals. The host converts before talking to the page, so the
 * page script never does this math itself.
 */
import type { MapRegion } from '@/utils/geo';

/** Leaflet `LatLngBounds` literal: `[[south, west], [north, east]]`. */
export type LatLngBoundsLiteral = [[number, number], [number, number]];

/** Web Mercator cannot show the poles. */
export const MAX_MERCATOR_LATITUDE = 85.0511287798;
/** Smallest span a region is fitted to (≈ 50 m), so a zero-size region cannot zoom in forever. */
const MIN_DELTA = 0.0005;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** Normalizes a longitude to [-180, 180). */
export function wrapLongitude(longitude: number): number {
  return ((((longitude + 180) % 360) + 360) % 360) - 180;
}

/** The bounds a region covers (latitudes clamped to Web Mercator, longitudes may pass ±180). */
export function regionToBounds(region: MapRegion): LatLngBoundsLiteral {
  const halfLatitude = Math.max(Math.abs(region.latitudeDelta), MIN_DELTA) / 2;
  const halfLongitude = clamp(Math.abs(region.longitudeDelta), MIN_DELTA, 360) / 2;
  const south = clamp(region.latitude - halfLatitude, -MAX_MERCATOR_LATITUDE, MAX_MERCATOR_LATITUDE);
  const north = clamp(region.latitude + halfLatitude, -MAX_MERCATOR_LATITUDE, MAX_MERCATOR_LATITUDE);
  return [
    [south, region.longitude - halfLongitude],
    [north, region.longitude + halfLongitude],
  ];
}

/** The region of the visible bounds (center longitude normalized, spans capped to the world). */
export function boundsToRegion([[south, west], [north, east]]: LatLngBoundsLiteral): MapRegion {
  return {
    latitude: (south + north) / 2,
    longitude: wrapLongitude((west + east) / 2),
    latitudeDelta: clamp(north - south, 0, 180),
    longitudeDelta: clamp(east - west, 0, 360),
  };
}
