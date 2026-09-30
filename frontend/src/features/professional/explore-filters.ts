/**
 * Job-explorer filter state (services, distance, urgency) and its mapping to
 * `GET /professional/requests/nearby` params. The filter UI works with friendly values ("whole
 * service area", …); this module converts them into the REST params. Pure.
 */
import { URGENCY_LEVELS, type UrgencyLevel } from '@/constants/urgency-levels';
import { DISTANCE_FILTERS_KM, type DistanceFilterKm, type NearbyRequestsParams } from '@/types/api';
import type { CategoryId } from '@/types/domain';

export const EXPLORE_VIEW_MODES = ['map', 'list'] as const;
export type ExploreViewMode = (typeof EXPLORE_VIEW_MODES)[number];

export interface ExploreFilters {
  /** Subset of the professional's own categories; empty = all of them. */
  categoryIds: CategoryId[];
  /** A preset (the API accepts only those); `null` = the whole service area. */
  maxDistanceKm: DistanceFilterKm | null;
  /** Empty = every urgency. */
  urgencies: UrgencyLevel[];
}

export const DEFAULT_EXPLORE_FILTERS: ExploreFilters = {
  categoryIds: [],
  maxDistanceKm: null,
  urgencies: [],
};

/** Number of filter groups that narrow the results (drives the badge on the Filters button). */
export function countActiveFilters(filters: ExploreFilters): number {
  return [filters.categoryIds.length > 0, filters.maxDistanceKm !== null, filters.urgencies.length > 0].filter(Boolean).length;
}

export type NearbyFilterParams = Omit<NearbyRequestsParams, 'cursor' | 'limit'>;

/** Converts the UI filter state into query params (newest first), omitting neutral values. */
export function filtersToParams(filters: ExploreFilters): NearbyFilterParams {
  const params: NearbyFilterParams = {};
  if (filters.categoryIds.length > 0) params.categoryIds = [...filters.categoryIds].sort();
  if (filters.maxDistanceKm !== null) params.maxDistanceKm = filters.maxDistanceKm;
  if (filters.urgencies.length > 0) {
    params.urgencies = URGENCY_LEVELS.filter((level) => filters.urgencies.includes(level));
  }
  return params;
}

/**
 * Distance presets that make sense for a service radius: presets smaller than the radius
 * (a preset equal to or above the radius is the same as "whole service area").
 */
export function distanceOptionsForRadius(radiusKm: number | null | undefined): DistanceFilterKm[] {
  const options = [...DISTANCE_FILTERS_KM];
  if (!radiusKm || radiusKm <= 0) return options;
  return options.filter((km) => km < radiusKm);
}

/**
 * Drops filter values that no longer apply after the profile changed: categories the professional
 * stopped offering and a distance at or beyond the (possibly reduced) service radius.
 */
export function sanitizeFilters(
  filters: ExploreFilters,
  ownCategoryIds: readonly CategoryId[] | null | undefined,
  serviceRadiusKm: number | null | undefined,
): ExploreFilters {
  const categoryIds = ownCategoryIds ? filters.categoryIds.filter((id) => ownCategoryIds.includes(id)) : filters.categoryIds;
  const maxDistanceKm =
    filters.maxDistanceKm !== null && serviceRadiusKm && filters.maxDistanceKm >= serviceRadiusKm ? null : filters.maxDistanceKm;
  if (categoryIds.length === filters.categoryIds.length && maxDistanceKm === filters.maxDistanceKm) return filters;
  return { ...filters, categoryIds, maxDistanceKm };
}

/** Adds `value` when missing, removes it when present (multi-select chips). */
export function toggleInList<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}
