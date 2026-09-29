import { skipToken, useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { api } from '@/services/api';

import { queryKeys } from './query-keys';
import { getNextPageParam, INITIAL_PAGE_PARAM, selectPaginatedList, useQueryScope } from './query-scope';

/** Messages per page in a chat. */
const MESSAGES_PAGE_SIZE = 30;

/** `GET /conversations` – the user's conversations, most recent activity first. */
export function useConversations() {
  const { userId, enabled } = useQueryScope();
  return useQuery({
    queryKey: queryKeys.conversations.list(userId),
    queryFn: ({ signal }) => api.conversations.getConversations(signal),
    enabled,
  });
}

/** `GET /conversations/:id` */
export function useConversation(conversationId: string | null | undefined) {
  const { userId, enabled } = useQueryScope();
  return useQuery({
    queryKey: queryKeys.conversations.detail(userId, conversationId ?? ''),
    queryFn:
      enabled && conversationId ? ({ signal }) => api.conversations.getConversationById(conversationId, signal) : skipToken,
  });
}

/**
 * `GET /conversations/:id/messages` – infinite, **newest first** (`data.items[0]` is the latest
 * message; render with an inverted list and `fetchNextPage` for older messages).
 * Pending optimistic messages are included (see `isPendingMessage`).
 */
export function useConversationMessages(conversationId: string | null | undefined) {
  const { userId, enabled } = useQueryScope();
  return useInfiniteQuery({
    queryKey: queryKeys.conversations.messages(userId, conversationId ?? ''),
    queryFn: ({ pageParam, signal }) =>
      api.conversations.getConversationMessages(conversationId ?? '', { cursor: pageParam, limit: MESSAGES_PAGE_SIZE }, signal),
    initialPageParam: INITIAL_PAGE_PARAM,
    getNextPageParam,
    select: selectPaginatedList,
    enabled: enabled && Boolean(conversationId),
  });
}
