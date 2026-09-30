import { skipToken, useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { api } from '@/services/api';
import type { JobScope } from '@/types/api';

import { queryKeys } from './query-keys';
import { DEFAULT_PAGE_SIZE, getNextPageParam, INITIAL_PAGE_PARAM, selectPaginatedList, useQueryScope } from './query-scope';

/**
 * `GET /jobs?scope=` – the signed-in user's jobs (customer or professional), infinite
 * (`fetchNextPage` for more). `pageSize` up to 100 where a screen needs every job at once.
 */
export function useJobs(scope: JobScope = 'all', { pageSize = DEFAULT_PAGE_SIZE }: { pageSize?: number } = {}) {
  const { userId, enabled } = useQueryScope();
  return useInfiniteQuery({
    queryKey: queryKeys.jobs.list(userId, scope, pageSize),
    queryFn: ({ pageParam, signal }) => api.jobs.getJobs({ scope, cursor: pageParam, limit: pageSize }, signal),
    initialPageParam: INITIAL_PAGE_PARAM,
    getNextPageParam,
    select: selectPaginatedList,
    enabled,
  });
}

/** `GET /jobs/:id` – job tracking details for either party. */
export function useJob(jobId: string | null | undefined) {
  const { userId, enabled } = useQueryScope();
  return useQuery({
    queryKey: queryKeys.jobs.detail(userId, jobId ?? ''),
    queryFn: enabled && jobId ? ({ signal }) => api.jobs.getJobById(jobId, signal) : skipToken,
  });
}
