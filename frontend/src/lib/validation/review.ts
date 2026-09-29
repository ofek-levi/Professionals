/** Review validation: `POST /jobs/:id/review` payload and the review form. */
import { z } from 'zod';

import { APP_CONFIG } from '@/constants/app-config';
import { isRating } from '@/features/reviews/rating';
import type { CreateReviewPayload } from '@/types/api';
import { RATING_VALUES } from '@/types/domain';

import { nullableText, optionalText } from './common';
import { vm } from './messages';

/** `POST /jobs/:id/review` payload. */
export const createReviewSchema = z.object({
  rating: z.literal(RATING_VALUES, {
    error: (issue) => (issue.input === undefined || issue.input === null ? vm('review.ratingRequired') : vm('review.ratingInvalid')),
  }),
  comment: nullableText(APP_CONFIG.reviewCommentMaxLength, vm('review.commentTooLong')).default(null),
});

/** Review form: `rating` is 0 until the customer taps a star. */
export const reviewFormSchema = z.object({
  rating: z.number().superRefine((value, ctx) => {
    if (value === 0) ctx.addIssue({ code: 'custom', message: vm('review.ratingRequired') });
    else if (!isRating(value)) ctx.addIssue({ code: 'custom', message: vm('review.ratingInvalid') });
  }),
  comment: optionalText(APP_CONFIG.reviewCommentMaxLength, vm('review.commentTooLong')),
});

export type ReviewFormValues = z.input<typeof reviewFormSchema>;

export const EMPTY_REVIEW_FORM_VALUES: ReviewFormValues = { rating: 0, comment: '' };

export function toCreateReviewPayload(values: ReviewFormValues): CreateReviewPayload {
  if (!isRating(values.rating)) throw new Error('Review form is invalid – validate it before building the payload');
  const comment = values.comment.trim();
  return { rating: values.rating, comment: comment.length > 0 ? comment : null };
}
