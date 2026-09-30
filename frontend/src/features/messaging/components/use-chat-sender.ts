import { useSession } from '@/features/auth';
import { useSendMessage } from '@/hooks';
import { sendMessageSchema } from '@/lib/validation';
import { createClientMessageId } from '@/utils/id';

import type { FailedMessage, OutgoingMessage } from './chat-model';
import { failedMessagesStore, useFailedMessages } from './failed-messages-store';
import { canRetrySend, sendFailureReason } from './send-failure';

interface ChatSender {
  /** Validates + normalizes the text and sends it optimistically. Returns `false` when invalid. */
  send: (text: string) => boolean;
  /**
   * Re-sends a failed message with the same `clientMessageId` (idempotent on the server); ignored
   * when retrying cannot work (the chat was closed or the server refused the message).
   */
  retry: (message: FailedMessage) => void;
  /** Drops a failed message from the chat. */
  discard: (message: FailedMessage) => void;
  /** Messages whose last attempt failed (the mutation removed their optimistic copy). */
  failed: readonly FailedMessage[];
}

/**
 * Chat sending on top of `useSendMessage`: the optimistic message shows as "sending"; when a send
 * fails it is kept (per user and conversation, for the session) as a failed message, with the
 * reason, that the user can retry (when that can work) or delete.
 *
 * `mutateAsync` is used (instead of per-call `mutate` callbacks) so every concurrent send reports
 * its own failure, even when the user sends several messages quickly.
 */
export function useChatSender(conversationId: string): ChatSender {
  const { userId } = useSession();
  const mutation = useSendMessage(conversationId);
  const storeKey = `${userId ?? ''}:${conversationId}`;
  const failed = useFailedMessages(storeKey);

  const deliver = ({ clientMessageId, text, createdAt }: OutgoingMessage) => {
    mutation.mutateAsync({ text, clientMessageId }).catch((error: unknown) => {
      failedMessagesStore.add(storeKey, { clientMessageId, text, createdAt, reason: sendFailureReason(error) });
    });
  };

  return {
    send: (text) => {
      const parsed = sendMessageSchema.safeParse({ text, clientMessageId: createClientMessageId() });
      if (!parsed.success) return false;
      deliver({ ...parsed.data, createdAt: new Date().toISOString() });
      return true;
    },
    retry: (message) => {
      if (!canRetrySend(message.reason)) return;
      failedMessagesStore.remove(storeKey, message.clientMessageId);
      deliver(message);
    },
    discard: (message) => failedMessagesStore.remove(storeKey, message.clientMessageId),
    failed,
  };
}
