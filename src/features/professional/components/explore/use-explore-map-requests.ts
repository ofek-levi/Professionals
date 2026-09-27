/**
 * Markers of the explore map (and the live count of the filters sheet).
 *
 * Workaround: the shared `useNearbyRequestsForMap` asks for `limit=200`, which the backend rejects
 * (max page size is 100 → 422). We read the first page of `useNearbyOpenRequests` with the largest
 * allowed page size instead and keep the previous markers visible while a new filter combination
 * loads (like `keepPreviousData`).
 */
import { useState } from 'react';

import { useNearbyOpenRequests } from '@/hooks';

import type { NearbyFilterParams } from '../../explore-filters';

/** Largest page the backend accepts (`MAX_PAGE_SIZE`). */
export const EXPLORE_MAP_PAGE_SIZE = 100;

export function useExploreMapRequests(params: NearbyFilterParams) {
  const query = useNearbyOpenRequests({ ...params, limit: EXPLORE_MAP_PAGE_SIZE });
  const [previous, setPrevious] = useState(query.data);
  if (query.data !== undefined && query.data !== previous) setPrevious(query.data);
  const data = query.data ?? previous;
  return {
    data: data ? { items: data.items, totalCount: data.totalCount } : undefined,
    /** Showing the previous filter's markers while the new ones load. */
    isPlaceholderData: query.data === undefined && previous !== undefined,
    isPending: data === undefined && query.isPending,
    isFetching: query.isFetching,
    isError: query.isError,
    isRefetching: query.isRefetching,
    error: query.error,
    refetch: query.refetch,
  };
}
