import type { CreateReviewPayload, JobsParams } from '@/types/api';
import type { Job, JobDetails, JobSummary, Review } from '@/types/domain';
import type { ApiClient } from '../client';

const id = (value: string) => encodeURIComponent(value);

export function createJobsApi(client: ApiClient) {
  return {
    /** `GET /jobs?scope=` – jobs of the current user (customer or professional). */
    getJobs: (params: JobsParams = {}, signal?: AbortSignal) =>
      client.get<JobSummary[]>('/jobs', { signal, query: { scope: params.scope } }),

    /** Convenience for `GET /jobs?scope=active`. */
    getActiveJobs: (signal?: AbortSignal) => client.get<JobSummary[]>('/jobs', { signal, query: { scope: 'active' } }),

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
