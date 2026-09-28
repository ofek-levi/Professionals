/**
 * Viewport helpers shared by both map implementations.
 * Distance/region primitives come from `utils/geo`.
 */
import type { GeoCoordinates } from '@/types/domain';
import { DEFAULT_MAP_REGION, regionForCoordinates, regionForRadius, type MapRegion } from '@/utils/geo';

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

/** Picks the initial viewport: explicit region → pin → fitted content → default city region. */
export function resolveInitialRegion(options: {
  region?: MapRegion;
  initialRegion?: MapRegion;
  markers: readonly AppMapMarker[];
  circles: readonly AppMapCircle[];
  pin?: AppMapDraggablePin;
}): MapRegion {
  const { region, initialRegion, markers, circles, pin } = options;
  if (region) return region;
  if (initialRegion) return initialRegion;
  if (pin) return regionForRadius(pin.coordinate, 1);
  const points = contentCoordinates(markers, circles, pin);
  if (points.length > 0) return regionForCoordinates(points, 1.3);
  return DEFAULT_MAP_REGION;
}

/** Stable string key for a region (used to detect focus-region changes). */
export function regionKey(region: MapRegion | undefined): string {
  if (!region) return '';
  return [region.latitude, region.longitude, region.latitudeDelta, region.longitudeDelta].map((value) => value.toFixed(5)).join('|');
}
