import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { CHAT_NOTIFICATION_TYPES } from '@/constants/notification-types';
import { api } from '@/services/api';
import type { NotificationsParams, UnreadCountResponse } from '@/types/api';

import { queryKeys } from './query-keys';
import {
  DEFAULT_PAGE_SIZE,
  getNextPageParam,
  INITIAL_PAGE_PARAM,
  selectPaginatedList,
  useQueryScope,
} from './query-scope';

type NotificationsQueryParams = Omit<NotificationsParams, 'cursor'>;

const selectCount = (data: UnreadCountResponse) => data.count;

/** `GET /notifications` – newest first, infinite. */
export function useNotifications(params: NotificationsQueryParams = {}) {
  const { userId, enabled } = useQueryScope();
  const filters: NotificationsQueryParams = { ...params, limit: params.limit ?? DEFAULT_PAGE_SIZE };
  return useInfiniteQuery({
    queryKey: queryKeys.notifications.list(userId, filters),
    queryFn: ({ pageParam, signal }) => api.notifications.getNotifications({ ...filters, cursor: pageParam }, signal),
    initialPageParam: INITIAL_PAGE_PARAM,
    getNextPageParam,
    select: selectPaginatedList,
    enabled,
  });
}

/** `GET /notifications` of the Inbox's Updates: every type except chat messages (filtered by the server). */
export function useUpdateNotifications() {
  return useNotifications({ excludeTypes: CHAT_NOTIFICATION_TYPES });
}

/**
 * Unread notifications listed under Updates (`data` is a number; chat notifications are left out
 * by the server, they count under Messages) – the Updates segment and the Inbox tab badge.
 */
export function useUnreadNotificationsCount() {
  const { userId, enabled } = useQueryScope();
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount(userId),
    queryFn: ({ signal }) => api.notifications.getUnreadCount({ excludeTypes: CHAT_NOTIFICATION_TYPES }, signal),
    select: selectCount,
    enabled,
  });
}
