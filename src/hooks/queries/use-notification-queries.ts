import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

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

export type NotificationsQueryParams = Omit<NotificationsParams, 'cursor'>;

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

/** Unread notifications count (`data` is a number) – tab badges, bell icons. */
export function useUnreadNotificationsCount() {
  const { userId, enabled } = useQueryScope();
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount(userId),
    queryFn: ({ signal }) => api.notifications.getUnreadCount(signal),
    select: selectCount,
    enabled,
  });
}
