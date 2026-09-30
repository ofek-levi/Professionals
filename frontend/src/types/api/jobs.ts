import type { Rating } from '../domain';
import type { PaginationParams } from './common';

export const JOB_SCOPES = ['active', 'upcoming', 'completed', 'all'] as const;
export type JobScope = (typeof JOB_SCOPES)[number];

/** `GET /jobs` */
export interface JobsParams extends PaginationParams {
  scope?: JobScope;
}

/** `POST /jobs/:id/review` */
export interface CreateReviewPayload {
  rating: Rating;
  comment: string | null;
}
