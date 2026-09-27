import type { NotificationsParams, Paginated, SuccessResponse, UnreadCountResponse } from '@/types/api';
import type { AppNotification } from '@/types/domain';
import type { ApiClient } from '../client';

const id = (value: string) => encodeURIComponent(value);

export function createNotificationsApi(client: ApiClient) {
  return {
    /** `GET /notifications` – newest first. */
    getNotifications: (params: NotificationsParams = {}, signal?: AbortSignal) =>
      client.get<Paginated<AppNotification>>('/notifications', {
        signal,
        query: { unreadOnly: params.unreadOnly, cursor: params.cursor, limit: params.limit },
      }),
    /** `GET /notifications/unread-count` */
    getUnreadCount: (signal?: AbortSignal) => client.get<UnreadCountResponse>('/notifications/unread-count', { signal }),
    /** `POST /notifications/:id/read` */
    markNotificationAsRead: (notificationId: string) =>
      client.post<AppNotification>(`/notifications/${id(notificationId)}/read`),
    /** `POST /notifications/read-all` */
    markAllNotificationsAsRead: () => client.post<SuccessResponse>('/notifications/read-all'),
  };
}
