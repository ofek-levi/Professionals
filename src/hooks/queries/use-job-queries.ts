import { skipToken, useQuery } from '@tanstack/react-query';

import { api } from '@/services/api';
import type { JobScope } from '@/types/api';

import { queryKeys } from './query-keys';
import { useQueryScope } from './query-scope';

/** `GET /jobs?scope=` – the signed-in user's jobs (customer or professional). */
export function useJobs(scope: JobScope = 'all') {
  const { userId, enabled } = useQueryScope();
  return useQuery({
    queryKey: queryKeys.jobs.list(userId, scope),
    queryFn: ({ signal }) => api.jobs.getJobs({ scope }, signal),
    enabled,
  });
}

/** Active jobs (awaiting confirmation, scheduled, in progress). Shares the cache with `useJobs('active')`. */
export function useActiveJobs() {
  const { userId, enabled } = useQueryScope();
  return useQuery({
    queryKey: queryKeys.jobs.list(userId, 'active'),
    queryFn: ({ signal }) => api.jobs.getActiveJobs(signal),
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
