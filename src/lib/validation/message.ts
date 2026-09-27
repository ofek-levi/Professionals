/** Chat message validation (`POST /conversations/:id/messages`). */
import { z } from 'zod';

import { APP_CONFIG } from '@/constants/app-config';
import { normalizeMessageText } from '@/features/messaging/message-rules';

import { vm } from './messages';

/** Message text: normalized (see `normalizeMessageText`), non-empty and within the length limit. */
export const messageTextSchema = z
  .string({ error: vm('message.empty') })
  .transform((value) => normalizeMessageText(value))
  .pipe(z.string().min(1, vm('message.empty')).max(APP_CONFIG.messageMaxLength, vm('message.tooLong')));

export const sendMessageSchema = z.object({
  text: messageTextSchema,
  clientMessageId: z.string({ error: vm('invalid') }).trim().min(1, vm('invalid')).max(100, vm('invalid')),
});
