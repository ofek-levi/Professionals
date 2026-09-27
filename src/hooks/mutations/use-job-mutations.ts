import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/hooks/queries/query-keys';
import { useQueryScope } from '@/hooks/queries/query-scope';
import { api } from '@/services/api';
import type { CreateReviewPayload } from '@/types/api';
import type { Job, JobDetails } from '@/types/domain';

import { invalidateJobGraph, invalidateProfessional } from './invalidation';

/** Applies a job transition result to the cached job details, then refreshes the job graph. */
function applyJobUpdate(qc: QueryClient, userId: string | null, job: Job): void {
  qc.setQueryData<JobDetails>(queryKeys.jobs.detail(userId, job.id), (current) => (current ? { ...current, ...job } : current));
  void invalidateJobGraph(qc, userId, { jobId: job.id, requestId: job.requestId });
}

function useJobTransition(transition: (jobId: string) => Promise<Job>) {
  const qc = useQueryClient();
  const { userId } = useQueryScope();
  return useMutation({
    mutationFn: transition,
    onSuccess: (job) => applyJobUpdate(qc, userId, job),
  });
}

/** `POST /jobs/:id/confirm` – the professional confirms the appointment. */
export function useConfirmJob() {
  return useJobTransition(api.jobs.confirmJob);
}

/** `POST /jobs/:id/start` – the professional starts the work. */
export function useStartJob() {
  return useJobTransition(api.jobs.startJob);
}

/** `POST /jobs/:id/complete` – either party marks the job as completed. */
export function useCompleteJob() {
  return useJobTransition(api.jobs.completeJob);
}

export interface CreateReviewVariables {
  jobId: string;
  payload: CreateReviewPayload;
}

/** `POST /jobs/:id/review` – the customer reviews a completed job. */
export function useCreateReview() {
  const qc = useQueryClient();
  const { userId } = useQueryScope();
  return useMutation({
    mutationFn: ({ jobId, payload }: CreateReviewVariables) => api.jobs.createReview(jobId, payload),
    onSuccess: (review) => {
      qc.setQueryData<JobDetails>(queryKeys.jobs.detail(userId, review.jobId), (current) =>
        current ? { ...current, review, reviewId: review.id, canReview: false } : current,
      );
      void invalidateJobGraph(qc, userId, { jobId: review.jobId });
      void invalidateProfessional(qc, userId, review.professionalId);
    },
  });
}
