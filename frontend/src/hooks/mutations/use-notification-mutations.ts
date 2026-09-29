import { useMutation, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query';

import { queryKeys } from '@/hooks/queries/query-keys';
import { useQueryScope, type PaginatedInfiniteData } from '@/hooks/queries/query-scope';
import { api } from '@/services/api';
import type { UnreadCountResponse } from '@/types/api';
import type { AppNotification } from '@/types/domain';

import { adjustUnreadCount, isNotificationUnread, markAllNotificationsRead, markNotificationRead } from './cache-updates';
import { invalidateNotifications } from './invalidation';

interface NotificationsSnapshot {
  lists: [QueryKey, PaginatedInfiniteData<AppNotification> | undefined][];
  unreadCount: UnreadCountResponse | undefined;
}

async function snapshotNotifications(qc: QueryClient, userId: string | null): Promise<NotificationsSnapshot> {
  await qc.cancelQueries({ queryKey: queryKeys.notifications.all(userId) });
  return {
    lists: qc.getQueriesData<PaginatedInfiniteData<AppNotification>>({ queryKey: queryKeys.notifications.lists(userId) }),
    unreadCount: qc.getQueryData<UnreadCountResponse>(queryKeys.notifications.unreadCount(userId)),
  };
}

function restoreNotifications(qc: QueryClient, userId: string | null, snapshot: NotificationsSnapshot | undefined): void {
  if (!snapshot) return;
  snapshot.lists.forEach(([key, data]) => qc.setQueryData(key, data));
  qc.setQueryData(queryKeys.notifications.unreadCount(userId), snapshot.unreadCount);
}

/**
 * `POST /notifications/:id/read` – optimistic: the item is marked read in every cached list and
 * the unread badge is decremented immediately; both roll back on error.
 */
export function useMarkNotificationAsRead() {
  const qc = useQueryClient();
  const { userId } = useQueryScope();
  return useMutation({
    mutationFn: (notificationId: string) => api.notifications.markNotificationAsRead(notificationId),
    onMutate: async (notificationId) => {
      const snapshot = await snapshotNotifications(qc, userId);
      const wasUnread = snapshot.lists.some(([, data]) => isNotificationUnread(data, notificationId));
      const readAt = new Date().toISOString();
      qc.setQueriesData<PaginatedInfiniteData<AppNotification>>({ queryKey: queryKeys.notifications.lists(userId) }, (data) =>
        markNotificationRead(data, notificationId, readAt),
      );
      if (wasUnread) {
        qc.setQueryData<UnreadCountResponse>(queryKeys.notifications.unreadCount(userId), (data) => adjustUnreadCount(data, -1));
      }
      return snapshot;
    },
    onError: (_error, _id, snapshot) => restoreNotifications(qc, userId, snapshot),
    onSettled: () => {
      void invalidateNotifications(qc, userId);
    },
  });
}

/** `POST /notifications/read-all` – optimistic: everything read, badge cleared; rolls back on error. */
export function useMarkAllNotificationsAsRead() {
  const qc = useQueryClient();
  const { userId } = useQueryScope();
  return useMutation({
    mutationFn: () => api.notifications.markAllNotificationsAsRead(),
    onMutate: async () => {
      const snapshot = await snapshotNotifications(qc, userId);
      const readAt = new Date().toISOString();
      qc.setQueriesData<PaginatedInfiniteData<AppNotification>>({ queryKey: queryKeys.notifications.lists(userId) }, (data) =>
        markAllNotificationsRead(data, readAt),
      );
      qc.setQueryData<UnreadCountResponse>(queryKeys.notifications.unreadCount(userId), (data) => (data ? { count: 0 } : data));
      return snapshot;
    },
    onError: (_error, _variables, snapshot) => restoreNotifications(qc, userId, snapshot),
    onSettled: () => {
      void invalidateNotifications(qc, userId);
    },
  });
}
