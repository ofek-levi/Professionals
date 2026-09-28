/**
 * Equirectangular projection used by the web map canvas. Pure functions, easy to test.
 * Longitudes are scaled by cos(latitude) so a kilometer is the same number of pixels on both axes.
 */
import type { GeoCoordinates } from '@/types/domain';
import type { MapRegion } from '@/utils/geo';

const KM_PER_DEGREE_LATITUDE = 110.574;
const MIN_LATITUDE_DELTA = 0.002;
const MAX_LATITUDE_DELTA = 40;

export interface Viewport {
  center: GeoCoordinates;
  /** Visible latitude span in degrees (zoom level). */
  latitudeDelta: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

const cosLatitude = (latitude: number) => Math.max(Math.cos((latitude * Math.PI) / 180), 0.01);

export function clampLatitudeDelta(delta: number): number {
  return Math.min(Math.max(delta, MIN_LATITUDE_DELTA), MAX_LATITUDE_DELTA);
}

/** Visible longitude span for the viewport's aspect ratio. */
export function longitudeDelta(viewport: Viewport): number {
  return (viewport.latitudeDelta * (viewport.width / Math.max(viewport.height, 1))) / cosLatitude(viewport.center.latitude);
}

/** Latitude span that shows the whole `region` inside a `width` × `height` canvas. */
export function latitudeDeltaToFit(region: MapRegion, width: number, height: number): number {
  const fromLongitude = region.longitudeDelta * cosLatitude(region.latitude) * (height / Math.max(width, 1));
  return clampLatitudeDelta(Math.max(region.latitudeDelta, fromLongitude));
}

export function project(viewport: Viewport, coordinate: GeoCoordinates): Point {
  return {
    x: ((coordinate.longitude - viewport.center.longitude) / longitudeDelta(viewport) + 0.5) * viewport.width,
    y: ((viewport.center.latitude - coordinate.latitude) / viewport.latitudeDelta + 0.5) * viewport.height,
  };
}

export function unproject(viewport: Viewport, point: Point): GeoCoordinates {
  return {
    latitude: viewport.center.latitude - (point.y / viewport.height - 0.5) * viewport.latitudeDelta,
    longitude: viewport.center.longitude + (point.x / viewport.width - 0.5) * longitudeDelta(viewport),
  };
}

/** Pixels per kilometer at the current zoom. */
export function pixelsPerKm(viewport: Viewport): number {
  return viewport.height / (viewport.latitudeDelta * KM_PER_DEGREE_LATITUDE);
}

const NICE_STEPS = [0.0005, 0.001, 0.002, 0.0025, 0.005, 0.01, 0.02, 0.025, 0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10];

/** Grid spacing (degrees of latitude) giving roughly `targetPx` between streets. */
export function gridStep(viewport: Viewport, targetPx = 56): number {
  const raw = (viewport.latitudeDelta * targetPx) / Math.max(viewport.height, 1);
  return NICE_STEPS.find((step) => step >= raw) ?? NICE_STEPS[NICE_STEPS.length - 1];
}

/** Deterministic pseudo-random integer for a grid cell, so the fake city is stable while panning. */
export function cellHash(a: number, b = 0): number {
  let hash = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b ^ 0xc2b2ae35, 0x27d4eb2f);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x2c1b3c6d);
  hash ^= hash >>> 12;
  return Math.abs(hash);
}
