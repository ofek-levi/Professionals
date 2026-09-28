/**
 * Geocoding hooks (address autocomplete and reverse geocoding) backed by `GET /geo/*`.
 */
import { keepPreviousData, skipToken, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { api } from '@/services/api';
import type { GeoCoordinates } from '@/types/domain';

import { queryKeys } from './query-keys';

const SEARCH_DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;
const GEO_STALE_TIME_MS = 10 * 60 * 1000;
/** ~1 m precision – avoids refetching for sub-meter jitter while dragging a pin. */
const COORDINATE_PRECISION = 5;

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

interface UsePlaceSearchOptions {
  limit?: number;
  enabled?: boolean;
}

/**
 * Debounced (300 ms) address autocomplete. Runs only for queries of at least 2 characters and keeps
 * the previous suggestions visible while the next ones load.
 */
export function usePlaceSearch(query: string, options: UsePlaceSearchOptions = {}) {
  const { limit = 6, enabled = true } = options;
  const trimmed = query.trim();
  const debounced = useDebouncedValue(trimmed, SEARCH_DEBOUNCE_MS);
  const canSearch = enabled && debounced.length >= MIN_QUERY_LENGTH;

  const result = useQuery({
    queryKey: queryKeys.geo.search(debounced),
    queryFn: canSearch ? ({ signal }) => api.geo.searchPlaces({ query: debounced, limit }, signal) : skipToken,
    staleTime: GEO_STALE_TIME_MS,
    placeholderData: keepPreviousData,
  });

  return {
    ...result,
    /** The (debounced) term the current results belong to. */
    searchTerm: debounced,
    /** `true` while the user is still typing (debounce pending). */
    isDebouncing: trimmed !== debounced,
    /** Whether the query is long enough to search at all. */
    isSearchable: enabled && trimmed.length >= MIN_QUERY_LENGTH,
  };
}

function roundCoordinate(value: number): number {
  const factor = 10 ** COORDINATE_PRECISION;
  return Math.round(value * factor) / factor;
}

/** Nearest address for a coordinate; idle while `coordinates` is `null`. */
export function useReverseGeocode(coordinates: GeoCoordinates | null) {
  const rounded = coordinates
    ? { latitude: roundCoordinate(coordinates.latitude), longitude: roundCoordinate(coordinates.longitude) }
    : null;

  return useQuery({
    queryKey: queryKeys.geo.reverse(rounded?.latitude ?? 0, rounded?.longitude ?? 0),
    queryFn: rounded ? ({ signal }) => api.geo.reverseGeocode(rounded, signal) : skipToken,
    staleTime: GEO_STALE_TIME_MS,
  });
}
