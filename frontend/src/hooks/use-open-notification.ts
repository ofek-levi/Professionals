import { useRouter } from 'expo-router';

import { getNotificationHref } from '@/features/notifications/notification-routing';
import { useMarkNotificationAsRead } from '@/hooks/mutations/use-notification-mutations';
import type { AppNotification } from '@/types/domain';

/**
 * Opens a notification: marks it as read (optimistically) and navigates to its target.
 * Used by the notification list and by tapped banners.
 */
export function useOpenNotification(): (notification: Pick<AppNotification, 'id' | 'type' | 'target' | 'readAt'>) => void {
  const router = useRouter();
  const markAsRead = useMarkNotificationAsRead();
  return (notification) => {
    if (notification.readAt === null) markAsRead.mutate(notification.id);
    const href = getNotificationHref(notification);
    if (href) router.push(href);
  };
}
