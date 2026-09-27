/**
 * Job-explorer filter state and its mapping to `GET /professional/requests/nearby` params.
 *
 * The filter UI works with friendly values (a preferred-date *window*, "whole service area", …);
 * this module converts them into the REST params. Pure and deterministic given `now`.
 */
import { APP_CONFIG } from '@/constants/app-config';
import { URGENCY_LEVELS, type UrgencyLevel } from '@/constants/urgency-levels';
import type { NearbyRequestSort, NearbyRequestsParams, OfferPresenceFilter } from '@/types/api';
import type { CategoryId, ISODateString } from '@/types/domain';
import { addDays, toDate, toDateKey, type DateInput } from '@/utils/dates';

export const EXPLORE_VIEW_MODES = ['map', 'list'] as const;
export type ExploreViewMode = (typeof EXPLORE_VIEW_MODES)[number];

/** Preferred-date windows offered by the filter sheet. */
export const DATE_WINDOWS = ['any', 'today', 'next3days', 'thisWeek'] as const;
export type DateWindow = (typeof DATE_WINDOWS)[number];

export interface ExploreFilters {
  /** Subset of the professional's own categories; empty = all of them. */
  categoryIds: CategoryId[];
  /** `null` = the whole service area. */
  maxDistanceKm: number | null;
  /** Empty = every urgency. */
  urgencies: UrgencyLevel[];
  dateWindow: DateWindow;
  offerPresence: OfferPresenceFilter;
  /** Hide requests the professional already sent an offer to. */
  hideWithMyOffer: boolean;
}

export const DEFAULT_EXPLORE_FILTERS: ExploreFilters = {
  categoryIds: [],
  maxDistanceKm: null,
  urgencies: [],
  dateWindow: 'any',
  offerPresence: 'any',
  hideWithMyOffer: false,
};

export const DEFAULT_EXPLORE_SORT: NearbyRequestSort = 'newest';

/** Number of filter groups that narrow the results (drives the badge on the Filters button). */
export function countActiveFilters(filters: ExploreFilters): number {
  return [
    filters.categoryIds.length > 0,
    filters.maxDistanceKm !== null,
    filters.urgencies.length > 0,
    filters.dateWindow !== 'any',
    filters.offerPresence !== 'any',
    filters.hideWithMyOffer,
  ].filter(Boolean).length;
}

export function hasActiveFilters(filters: ExploreFilters): boolean {
  return countActiveFilters(filters) > 0;
}

/**
 * Inclusive preferred-date range for a window, as local `YYYY-MM-DD` keys.
 * - `today`: today only
 * - `next3days`: today and the next two days
 * - `thisWeek`: today until the end of the week (Saturday – the Israeli week starts on Sunday)
 */
export function preferredDateRange(window: DateWindow, now: DateInput): { from: ISODateString; to: ISODateString } | null {
  const today = toDate(now);
  switch (window) {
    case 'any':
      return null;
    case 'today':
      return { from: toDateKey(today), to: toDateKey(today) };
    case 'next3days':
      return { from: toDateKey(today), to: toDateKey(addDays(today, 2)) };
    case 'thisWeek':
      return { from: toDateKey(today), to: toDateKey(addDays(today, 6 - today.getDay())) };
  }
}

export type NearbyFilterParams = Omit<NearbyRequestsParams, 'cursor' | 'limit'>;

/** Converts the UI filter state (+ optional sort) into query params, omitting neutral values. */
export function filtersToParams(filters: ExploreFilters, now: DateInput, sort?: NearbyRequestSort): NearbyFilterParams {
  const params: NearbyFilterParams = {};
  if (filters.categoryIds.length > 0) params.categoryIds = [...filters.categoryIds].sort();
  if (filters.maxDistanceKm !== null) params.maxDistanceKm = filters.maxDistanceKm;
  if (filters.urgencies.length > 0) {
    params.urgencies = URGENCY_LEVELS.filter((level) => filters.urgencies.includes(level));
  }
  const range = preferredDateRange(filters.dateWindow, now);
  if (range) {
    params.preferredDateFrom = range.from;
    params.preferredDateTo = range.to;
  }
  if (filters.offerPresence !== 'any') params.offerPresence = filters.offerPresence;
  if (filters.hideWithMyOffer) params.excludeWithMyOffer = true;
  if (sort) params.sort = sort;
  return params;
}

/**
 * Distance presets that make sense for a service radius: presets smaller than the radius
 * (a preset equal to or above the radius is the same as "whole service area").
 */
export function distanceOptionsForRadius(radiusKm: number | null | undefined): number[] {
  const options = [...APP_CONFIG.distanceFilterOptionsKm];
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

export function areFiltersEqual(a: ExploreFilters, b: ExploreFilters): boolean {
  const sameSet = <T>(x: readonly T[], y: readonly T[]) => x.length === y.length && x.every((item) => y.includes(item));
  return (
    sameSet(a.categoryIds, b.categoryIds) &&
    a.maxDistanceKm === b.maxDistanceKm &&
    sameSet(a.urgencies, b.urgencies) &&
    a.dateWindow === b.dateWindow &&
    a.offerPresence === b.offerPresence &&
    a.hideWithMyOffer === b.hideWithMyOffer
  );
}
