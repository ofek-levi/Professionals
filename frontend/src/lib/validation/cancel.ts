/** Request cancellation (`POST /requests/:id/cancel`). */
import { z } from 'zod';

import { CUSTOMER_CANCELLATION_REASONS } from '@/types/domain';

import { vm } from './messages';

export const CANCEL_COMMENT_MAX_LENGTH = 300;

export const cancelRequestSchema = z.object({
  reason: z.enum(CUSTOMER_CANCELLATION_REASONS, { error: vm('cancel.reasonRequired') }),
  comment: z
    .string()
    .trim()
    .max(CANCEL_COMMENT_MAX_LENGTH, vm('cancel.commentTooLong'))
    .nullable()
    .optional()
    .transform((value) => (value ? value : null)),
});
