/**
 * `$geoNear` in the app's units. MongoDB measures spherical distances on a 6378.1 km Earth; the app
 * (and `lib/geo.ts`) use haversine on 6371.0088 km, ~0.11 % less. Converting both ways keeps the
 * server's "within the service radius" and the distances it returns identical to the app's rules
 * (a request 19.99 km away is inside a 20 km radius everywhere).
 */
import type { PipelineStage } from 'mongoose';

import type { GeoCoordinates } from '../shared/contract/index.js';
import { toGeoPoint } from './geo.js';

const HAVERSINE_EARTH_RADIUS_KM = 6371.0088;
const MONGO_EARTH_RADIUS_M = 6378.1 * 1000;

interface GeoNearOptions {
  near: GeoCoordinates;
  /** 2dsphere-indexed path. */
  key: string;
  /** Output field: the haversine distance in km. */
  distanceField: string;
  maxDistanceKm: number;
  query: Record<string, unknown>;
}

export function geoNearStage({ near, key, distanceField, maxDistanceKm, query }: GeoNearOptions): PipelineStage.GeoNear {
  return {
    $geoNear: {
      near: toGeoPoint(near),
      key,
      distanceField,
      spherical: true,
      maxDistance: (maxDistanceKm / HAVERSINE_EARTH_RADIUS_KM) * MONGO_EARTH_RADIUS_M,
      distanceMultiplier: HAVERSINE_EARTH_RADIUS_KM / MONGO_EARTH_RADIUS_M,
      query,
    },
  };
}
