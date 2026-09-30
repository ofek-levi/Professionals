/** `Review` DTOs (reviewer name/avatar resolved from `users`, always current). */
import { required } from '../../lib/batch.js';
import type { Review } from '../../shared/contract/index.js';
import type { ReviewDoc } from '../reviews/review.model.js';
import { loadUserDisplays, type UserDisplay } from '../users/user-display.views.js';

function toReviewDto(review: ReviewDoc, reviewer: Pick<UserDisplay, 'shortName' | 'avatarUrl'>): Review {
  return {
    id: review._id.toHexString(),
    jobId: review.job.toHexString(),
    professionalId: review.professional.toHexString(),
    customerId: review.customer.toHexString(),
    categoryId: review.categoryId,
    rating: review.rating,
    comment: review.comment,
    // Customers appear as "Noa L." to everyone (as in the app).
    customerDisplayName: reviewer.shortName,
    customerAvatarUrl: reviewer.avatarUrl,
    createdAt: review.createdAt.toISOString(),
  };
}

/** A page of reviews with one users/professionals lookup for all reviewers. */
export async function toReviewDtos(reviews: ReviewDoc[]): Promise<Review[]> {
  const reviewers = await loadUserDisplays(reviews.map((review) => review.customer));
  return reviews.map((review) => toReviewDto(review, required(reviewers, review.customer, 'Reviewer')));
}
