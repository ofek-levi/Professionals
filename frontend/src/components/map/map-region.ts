/**
 * Viewport helpers of `AppMap` (initial camera, focus-region changes).
 * Distance/region primitives come from `utils/geo`.
 */
import type { GeoCoordinates } from '@/types/domain';
import { DEFAULT_MAP_REGION, isValidCoordinates, regionForCoordinates, regionForRadius, type MapRegion } from '@/utils/geo';

import type { AppMapCircle, AppMapDraggablePin, AppMapMarker } from './types';

/** All points that should be visible when fitting the map to its content. */
function contentCoordinates(
  markers: readonly AppMapMarker[],
  circles: readonly AppMapCircle[],
  pin: AppMapDraggablePin | undefined,
): GeoCoordinates[] {
  const points: GeoCoordinates[] = markers.map((marker) => marker.coordinate);
  for (const circle of circles) {
    const region = regionForRadius(circle.center, circle.radiusKm);
    points.push(
      { latitude: region.latitude + region.latitudeDelta / 2, longitude: region.longitude + region.longitudeDelta / 2 },
      { latitude: region.latitude - region.latitudeDelta / 2, longitude: region.longitude - region.longitudeDelta / 2 },
    );
  }
  if (pin) points.push(pin.coordinate);
  return points;
}

/**
 * A region the map can show: a valid center and finite, non-negative spans. Anything else (e.g.
 * `regionForRadius` of a malformed radius → NaN spans) would leave the map blank.
 */
export function isValidRegion(region: MapRegion | undefined): region is MapRegion {
  if (!region || !isValidCoordinates(region)) return false;
  const { latitudeDelta, longitudeDelta } = region;
  return Number.isFinite(latitudeDelta) && Number.isFinite(longitudeDelta) && latitudeDelta >= 0 && longitudeDelta >= 0;
}

/**
 * Picks the initial viewport: explicit region → pin → fitted content → default city region.
 * Invalid candidates are skipped, so the map always has a camera.
 */
export function resolveInitialRegion(options: {
  region?: MapRegion;
  initialRegion?: MapRegion;
  markers: readonly AppMapMarker[];
  circles: readonly AppMapCircle[];
  pin?: AppMapDraggablePin;
}): MapRegion {
  const { region, initialRegion, markers, circles, pin } = options;
  const validPin = pin && isValidCoordinates(pin.coordinate) ? pin : undefined;
  for (const candidate of [region, initialRegion, validPin ? regionForRadius(validPin.coordinate, 1) : undefined]) {
    if (isValidRegion(candidate)) return candidate;
  }
  const points = contentCoordinates(
    markers.filter((marker) => isValidCoordinates(marker.coordinate)),
    circles.filter((circle) => isValidCoordinates(circle.center) && Number.isFinite(circle.radiusKm) && circle.radiusKm > 0),
    validPin,
  );
  const fitted = points.length > 0 ? regionForCoordinates(points, 1.3) : undefined;
  if (isValidRegion(fitted)) return fitted;
  return DEFAULT_MAP_REGION;
}

/** Stable string key for a region (used to detect focus-region changes). */
export function regionKey(region: MapRegion | undefined): string {
  if (!region) return '';
  return [region.latitude, region.longitude, region.latitudeDelta, region.longitudeDelta].map((value) => value.toFixed(5)).join('|');
}
