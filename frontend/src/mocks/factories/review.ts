import type { Review } from '@/types/domain';

export type ReviewInput = Pick<
  Review,
  'id' | 'jobId' | 'professionalId' | 'customerId' | 'categoryId' | 'rating' | 'customerDisplayName' | 'createdAt'
> &
  Partial<Review>;

export function createReview(input: ReviewInput): Review {
  return { comment: null, customerAvatarUrl: null, ...input };
}
