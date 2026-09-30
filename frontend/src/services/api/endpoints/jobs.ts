import type { CreateReviewPayload, JobsParams, Paginated, WireQueries } from '@/types/api';
import type { Job, JobDetails, JobSummary, Review } from '@/types/domain';
import type { ApiClient } from '../client';

const id = (value: string) => encodeURIComponent(value);

export function createJobsApi(client: ApiClient) {
  return {
    /** `GET /jobs?scope=` – jobs of the current user (customer or professional), cursor paginated. */
    getJobs: (params: JobsParams = {}, signal?: AbortSignal) =>
      client.get<Paginated<JobSummary>>('/jobs', { signal, query: { scope: params.scope, cursor: params.cursor, limit: params.limit } satisfies WireQueries['/jobs'] }),

    /** `GET /jobs/:id` */
    getJobById: (jobId: string, signal?: AbortSignal) => client.get<JobDetails>(`/jobs/${id(jobId)}`, { signal }),

    /** `POST /jobs/:id/confirm` (professional confirms the appointment) */
    confirmJob: (jobId: string) => client.post<Job>(`/jobs/${id(jobId)}/confirm`),

    /** `POST /jobs/:id/start` (professional) */
    startJob: (jobId: string) => client.post<Job>(`/jobs/${id(jobId)}/start`),

    /** `POST /jobs/:id/complete` (customer or professional) */
    completeJob: (jobId: string) => client.post<Job>(`/jobs/${id(jobId)}/complete`),

    /** `POST /jobs/:id/review` (customer, completed jobs only) */
    createReview: (jobId: string, payload: CreateReviewPayload) => client.post<Review>(`/jobs/${id(jobId)}/review`, payload),
  };
}
