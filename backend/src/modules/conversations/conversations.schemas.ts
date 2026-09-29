/** zod schemas of the messaging routes (rules of the app's `lib/validation/message.ts`). */
import { z } from 'zod';

import { paginationQueryShape } from '../../lib/pagination.js';
import { normalizeMessageText } from '../../lib/text.js';
import { APP_CONFIG } from '../../shared/limits.js';
import { vm } from '../../shared/validation-messages.js';

export const conversationParams = z.object({ conversationId: z.string() });

export const conversationsPageQuery = z.object(paginationQueryShape);

/**
 * Normalized text (line endings, trailing spaces, blank lines), non-empty and within the limit.
 * The raw text is capped first (normalizing only shrinks it; twice the limit leaves room for CRLF
 * line endings and trailing spaces), so the transform never runs on a 100 kB body.
 */
const messageTextSchema = z
  .string({ error: vm('message.empty') })
  .max(APP_CONFIG.messageMaxLength * 2, vm('message.tooLong'))
  .transform(normalizeMessageText)
  .pipe(z.string().min(1, vm('message.empty')).max(APP_CONFIG.messageMaxLength, vm('message.tooLong')));

/** `POST /conversations/:id/messages` (`SendMessagePayload`). */
export const sendMessageBody = z.object({
  text: messageTextSchema,
  clientMessageId: z.string({ error: vm('invalid') }).trim().min(1, vm('invalid')).max(100, vm('invalid')),
});

export type SendMessageInput = z.output<typeof sendMessageBody>;
