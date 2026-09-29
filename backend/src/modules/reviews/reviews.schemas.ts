/** `POST /jobs/:id/review` payload (the app's `lib/validation/review.ts`). */
import { z } from 'zod';

import { RATING_VALUES } from '../../shared/domain.js';
import { APP_CONFIG } from '../../shared/limits.js';
import { vm } from '../../shared/validation-messages.js';
import { nullableText } from '../auth/auth-fields.schemas.js';

export const reviewJobParams = z.object({ jobId: z.string() });

export const createReviewBody = z.object({
  rating: z.literal(RATING_VALUES, {
    error: (issue) => (issue.input === undefined || issue.input === null ? vm('review.ratingRequired') : vm('review.ratingInvalid')),
  }),
  comment: nullableText(APP_CONFIG.reviewCommentMaxLength, vm('review.commentTooLong')).default(null),
});
export type CreateReviewInput = z.output<typeof createReviewBody>;
