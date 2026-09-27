import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/hooks/queries/query-keys';
import { useQueryScope, type PaginatedInfiniteData } from '@/hooks/queries/query-scope';
import { api } from '@/services/api';
import type { Conversation, Message } from '@/types/domain';
import { createClientMessageId } from '@/utils/id';

import {
  applyMessageToConversation,
  createOptimisticMessage,
  markConversationRead,
  removeMessageByClientId,
  upsertMessage,
} from './cache-updates';
import { invalidateConversation, invalidateNotifications } from './invalidation';

export interface SendMessageVariables {
  /** Normalized message text (see `normalizeMessageText`). */
  text: string;
  /**
   * Idempotency key. Pass the same id again to retry a failed message without creating a
   * duplicate; `send(text)` generates a new one.
   */
  clientMessageId: string;
}

/**
 * `POST /conversations/:id/messages` – optimistic chat send:
 * 1. the message is appended to the cached messages immediately (`isPendingMessage` is `true`);
 * 2. on success it is reconciled with the server copy by `clientMessageId` (also when the realtime
 *    echo arrived first, so it never shows twice);
 * 3. on error it is removed again (the screen should restore the text and show the error).
 *
 * `const { send } = useSendMessage(conversationId); send(text);`
 */
export function useSendMessage(conversationId: string) {
  const qc = useQueryClient();
  const { userId } = useQueryScope();
  const messagesKey = queryKeys.conversations.messages(userId, conversationId);

  const mutation = useMutation({
    mutationFn: ({ text, clientMessageId }: SendMessageVariables) =>
      api.conversations.sendMessage(conversationId, { text, clientMessageId }),
    onMutate: async ({ text, clientMessageId }) => {
      await qc.cancelQueries({ queryKey: messagesKey });
      if (!userId) return;
      const optimistic = createOptimisticMessage({ conversationId, senderId: userId, text, clientMessageId });
      qc.setQueryData<PaginatedInfiniteData<Message>>(messagesKey, (data) => upsertMessage(data, optimistic));
    },
    onError: (_error, { clientMessageId }) => {
      qc.setQueryData<PaginatedInfiniteData<Message>>(messagesKey, (data) => removeMessageByClientId(data, clientMessageId));
    },
    onSuccess: (message) => {
      qc.setQueryData<PaginatedInfiniteData<Message>>(messagesKey, (data) => upsertMessage(data, message));
      qc.setQueryData<Conversation[]>(queryKeys.conversations.list(userId), (list) =>
        list?.map((conversation) => applyMessageToConversation(conversation, message, userId)),
      );
    },
    onSettled: () => {
      void invalidateConversation(qc, userId, conversationId);
    },
  });

  const send = (text: string) => mutation.mutate({ text, clientMessageId: createClientMessageId() });

  return { ...mutation, send };
}

/**
 * `POST /conversations/:id/read` – optimistic: clears the conversation's unread counter; the
 * server also marks its message notifications read, so notifications are refreshed afterwards.
 */
export function useMarkConversationAsRead() {
  const qc = useQueryClient();
  const { userId } = useQueryScope();
  return useMutation({
    mutationFn: (conversationId: string) => api.conversations.markConversationAsRead(conversationId),
    onMutate: (conversationId) => {
      qc.setQueryData<Conversation[]>(queryKeys.conversations.list(userId), (list) =>
        list?.map((conversation) => (conversation.id === conversationId ? markConversationRead(conversation) : conversation)),
      );
      qc.setQueryData<Conversation>(queryKeys.conversations.detail(userId, conversationId), (conversation) =>
        conversation ? markConversationRead(conversation) : conversation,
      );
    },
    onSettled: (_result, _error, conversationId) => {
      void invalidateConversation(qc, userId, conversationId);
      void invalidateNotifications(qc, userId);
    },
  });
}
