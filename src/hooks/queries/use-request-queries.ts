import { keepPreviousData, skipToken, useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { api } from '@/services/api';
import type { CustomerRequestsParams, NearbyRequestsParams } from '@/types/api';

import { queryKeys } from './query-keys';
import {
  DEFAULT_PAGE_SIZE,
  getNextPageParam,
  INITIAL_PAGE_PARAM,
  selectPaginatedList,
  useQueryScope,
} from './query-scope';

/** Filters for list hooks; the cursor is managed by the infinite query. */
export type CustomerRequestsQueryParams = Omit<CustomerRequestsParams, 'cursor'>;
export type NearbyRequestsQueryParams = Omit<NearbyRequestsParams, 'cursor'>;

/** Max markers fetched for the explore map (single page). */
export const NEARBY_MAP_LIMIT = 200;

/** `GET /customer/requests` – infinite, cursor paginated (customers only). */
export function useCustomerRequests(params: CustomerRequestsQueryParams = {}) {
  const { userId, enabled } = useQueryScope('customer');
  const filters: CustomerRequestsQueryParams = { ...params, limit: params.limit ?? DEFAULT_PAGE_SIZE };
  return useInfiniteQuery({
    queryKey: queryKeys.requests.customerList(userId, filters),
    queryFn: ({ pageParam, signal }) => api.requests.getCustomerRequests({ ...filters, cursor: pageParam }, signal),
    initialPageParam: INITIAL_PAGE_PARAM,
    getNextPageParam,
    select: selectPaginatedList,
    enabled,
  });
}

/**
 * `GET /requests/:id` – role aware: `data.viewerRole` tells whether `data.request` is the
 * customer's `CustomerRequestView` or a professional's (redacted) `ProfessionalRequestView`.
 */
export function useRequest(requestId: string | null | undefined) {
  const { userId, enabled } = useQueryScope();
  return useQuery({
    queryKey: queryKeys.requests.detail(userId, requestId ?? ''),
    queryFn: enabled && requestId ? ({ signal }) => api.requests.getRequestById(requestId, signal) : skipToken,
  });
}

/** `GET /professional/requests/nearby` – infinite list for the job explorer (professionals only). */
export function useNearbyOpenRequests(params: NearbyRequestsQueryParams = {}) {
  const { userId, enabled } = useQueryScope('professional');
  const filters: NearbyRequestsQueryParams = { ...params, limit: params.limit ?? DEFAULT_PAGE_SIZE };
  return useInfiniteQuery({
    queryKey: queryKeys.requests.nearby(userId, filters),
    queryFn: ({ pageParam, signal }) => api.requests.getNearbyOpenRequests({ ...filters, cursor: pageParam }, signal),
    initialPageParam: INITIAL_PAGE_PARAM,
    getNextPageParam,
    select: selectPaginatedList,
    enabled,
  });
}

/**
 * Nearby requests for the map: one page of up to `NEARBY_MAP_LIMIT` markers. Keeps the previous
 * markers visible while a new filter combination loads.
 */
export function useNearbyRequestsForMap(params: Omit<NearbyRequestsQueryParams, 'limit'> = {}) {
  const { userId, enabled } = useQueryScope('professional');
  const filters: NearbyRequestsQueryParams = { ...params, limit: NEARBY_MAP_LIMIT };
  return useQuery({
    queryKey: queryKeys.requests.nearbyMap(userId, filters),
    queryFn: ({ signal }) => api.requests.getNearbyOpenRequests(filters, signal),
    placeholderData: keepPreviousData,
    enabled,
  });
}
