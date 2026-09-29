/**
 * Connects server push events to the app while signed in:
 * - every realtime event refreshes the affected queries (via `applyRealtimeEvent`);
 * - `notification.created` bumps the unread badge and is shown as an in-app banner through the
 *   push provider (respecting the user's notification preferences); tapping the banner marks the
 *   notification as read and opens its target.
 *
 * Mount inside the session, React Query, toast and navigation contexts.
 */
import { useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useEffectEvent, useRef, type ReactNode } from 'react';

import { useToast } from '@/components/ui';
import { useSession } from '@/features/auth/session-provider';
import { notificationTargetToHref } from '@/features/notifications/notification-routing';
import { useCurrentUser } from '@/hooks/queries/use-auth-queries';
import { useNotificationPresenter } from '@/hooks/use-notification-presenter';
import { useOpenNotification } from '@/hooks/use-open-notification';
import { pushProvider, type PushMessage } from '@/services/push';
import { realtimeClient, type RealtimeEvent } from '@/services/realtime';
import type { AppNotification, NotificationPreferences } from '@/types/domain';

import { applyRealtimeEvent, getActiveConversationId, shouldPresentBanner } from './realtime-events';

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { userId } = useSession();
  const toast = useToast();
  const pathname = usePathname();
  const router = useRouter();
  const currentUser = useCurrentUser();
  const present = useNotificationPresenter();
  const openNotification = useOpenNotification();

  const preferences: NotificationPreferences | null =
    currentUser.data?.customerProfile?.notificationPreferences ??
    currentUser.data?.professionalProfile?.notificationPreferences ??
    null;

  const presentNotification = (notification: AppNotification) => {
    const context = { preferences, activeConversationId: getActiveConversationId(pathname) };
    if (!shouldPresentBanner(notification, context)) return;
    const content = present(notification);
    pushProvider.deliver({
      id: notification.id,
      notificationId: notification.id,
      notificationType: notification.type,
      title: content.title,
      body: content.body,
      icon: content.icon,
      tone: content.tone,
      target: notification.target,
    });
  };

  const onRealtimeEvent = useEffectEvent((event: RealtimeEvent) => {
    if (!userId) return;
    applyRealtimeEvent(queryClient, userId, event);
    if (event.type === 'notification.created' && event.notification.userId === userId) {
      presentNotification(event.notification);
    }
  });

  const onBannerPressed = useEffectEvent((message: PushMessage) => {
    const { notificationId, notificationType } = message;
    if (notificationId && notificationType) {
      openNotification({ id: notificationId, type: notificationType, target: message.target, readAt: null });
      return;
    }
    const href = notificationTargetToHref(message.target);
    if (href) router.push(href);
  });

  const showBanner = useEffectEvent((message: PushMessage, onPress: () => void) => {
    toast.show({
      id: `push:${message.id}`,
      title: message.title,
      message: message.body,
      tone: message.tone,
      icon: message.icon,
      onPress,
      durationMs: 6000,
    });
  });

  // Realtime subscription for the signed-in user (the session lifecycle owns the connection).
  useEffect(() => {
    if (!userId) return undefined;
    return realtimeClient.subscribe((event) => onRealtimeEvent(event));
  }, [userId]);

  // In-app banners for the simulated push provider.
  useEffect(() => pushProvider.setBannerPresenter((message, onPress) => showBanner(message, onPress)), []);
  useEffect(() => pushProvider.onNotificationResponse((message) => onBannerPressed(message)), []);

  // Banners of a previous account must not survive an account switch.
  const previousUserId = useRef(userId);
  const dismissAllToasts = useEffectEvent(() => toast.dismissAll());
  useEffect(() => {
    if (previousUserId.current === userId) return;
    previousUserId.current = userId;
    dismissAllToasts();
  }, [userId]);

  return <>{children}</>;
}
