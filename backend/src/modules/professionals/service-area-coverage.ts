/**
 * "Which professionals' service areas cover this point": the aggregation stages behind request
 * matching and `GET /professionals?lat&lng`. They output professional documents with `distanceKm`
 * (haversine km from the chosen center, the app's rule) and keep only those within their own
 * `serviceArea.radiusKm`.
 * - Matching (who is told about a new request) measures from each professional's own `center`.
 * - The public search measures from `publicCenter`, the approximate center the public profile
 *   shows: a search answering "covered or not" around the exact center would let anyone probe the
 *   circle's edge and recover the hidden address.
 *
 * With a category, one `$geoNear` per radius bucket (the app's presets 5/10/20/40/80 km as upper
 * bounds), combined with `$unionWith`: each only walks the index entries of professionals whose
 * radius is in the bucket and who are within its upper bound, so a request no longer reads every
 * professional of the category within 80 km (the largest radius) to keep the few that cover it.
 * Most radii are exactly a preset, so almost nothing read is thrown away.
 */
import type { PipelineStage } from 'mongoose';

import { geoNearStage } from '../../lib/geo-near.js';
import type { CategoryId } from '../../shared/catalog/index.js';
import type { GeoCoordinates } from '../../shared/contract/index.js';
import { APP_CONFIG } from '../../shared/limits.js';
import { ProfessionalModel } from './professional.model.js';

type CenterKey = 'serviceArea.center' | 'serviceArea.publicCenter';

/** `(min, max]` radius ranges; the last upper bound is the largest radius the app allows. */
const RADIUS_BUCKETS: readonly (readonly [number, number])[] = APP_CONFIG.serviceRadiusPresetsKm.map((max, index, presets) => [
  index === 0 ? 0 : (presets[index - 1] ?? 0),
  index === presets.length - 1 ? Math.max(max, APP_CONFIG.maxServiceRadiusKm) : max,
]);

const withinOwnRadius: PipelineStage.Match = { $match: { $expr: { $lte: ['$distanceKm', '$serviceArea.radiusKm'] } } };

function geoNear(key: CenterKey, near: GeoCoordinates, maxDistanceKm: number, query: Record<string, unknown>): PipelineStage.GeoNear {
  return geoNearStage({ near, key, distanceField: 'distanceKm', maxDistanceKm, query });
}

/** Index per bucket: `{categoryIds, serviceArea.radiusKm, <key> 2dsphere}`. */
function bucketStages(key: CenterKey, near: GeoCoordinates, categoryId: CategoryId): PipelineStage[] {
  const [first, ...others] = RADIUS_BUCKETS.map(([minKm, maxKm]) => [
    geoNear(key, near, maxKm, { categoryIds: categoryId, 'serviceArea.radiusKm': { $gt: minKm, $lte: maxKm } }),
    withinOwnRadius,
  ]);
  return [
    ...(first ?? []),
    ...others.map((pipeline): PipelineStage.UnionWith => ({ $unionWith: { coll: ProfessionalModel.collection.collectionName, pipeline } })),
  ];
}

/** Professionals of `categoryId` whose own service area covers `near` (request matching), in no particular order. */
export function matchingProfessionalsStages(near: GeoCoordinates, categoryId: CategoryId): PipelineStage[] {
  return bucketStages('serviceArea.center', near, categoryId);
}

/**
 * Professionals (of `categoryId`, when given) whose public service area covers `near`, in no
 * particular order. Without a category, one scan of the largest radius on
 * `{serviceArea.publicCenter, categoryIds}`.
 */
export function publicCoverageStages(near: GeoCoordinates, categoryId: CategoryId | undefined): PipelineStage[] {
  if (!categoryId) return [geoNear('serviceArea.publicCenter', near, APP_CONFIG.maxServiceRadiusKm, {}), withinOwnRadius];
  return bucketStages('serviceArea.publicCenter', near, categoryId);
}
