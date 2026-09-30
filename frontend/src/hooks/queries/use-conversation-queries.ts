import { skipToken, useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { api } from '@/services/api';
import type { UnreadCountResponse } from '@/types/api';

import { queryKeys } from './query-keys';
import { DEFAULT_PAGE_SIZE, getNextPageParam, INITIAL_PAGE_PARAM, selectPaginatedList, useQueryScope } from './query-scope';

/** Messages per page in a chat. */
const MESSAGES_PAGE_SIZE = 30;

const selectCount = (data: UnreadCountResponse) => data.count;

/**
 * `GET /conversations` – infinite, most recent activity first. A new message moves its chat to the
 * top, so realtime events reload the list from the first page (see `invalidateConversation`).
 */
export function useConversations() {
  const { userId, enabled } = useQueryScope();
  return useInfiniteQuery({
    queryKey: queryKeys.conversations.list(userId),
    queryFn: ({ pageParam, signal }) => api.conversations.getConversations({ cursor: pageParam, limit: DEFAULT_PAGE_SIZE }, signal),
    initialPageParam: INITIAL_PAGE_PARAM,
    getNextPageParam,
    select: selectPaginatedList,
    enabled,
  });
}

/** Unread chat messages over all conversations (`data` is a number) – the inbox badge. */
export function useUnreadMessagesCount() {
  const { userId, enabled } = useQueryScope();
  return useQuery({
    queryKey: queryKeys.conversations.unreadCount(userId),
    queryFn: ({ signal }) => api.conversations.getUnreadMessagesCount(signal),
    select: selectCount,
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
