/**
 * Connects server events to the app while signed in:
 * - every realtime event refreshes the affected queries (via `applyRealtimeEvent`);
 * - `notification.created` bumps the unread badge and is shown as an in-app banner (respecting
 *   the user's notification preferences); tapping the banner marks the notification as read and
 *   opens its target;
 * - after the connection came back (network loss, server restart, back from the background) every
 *   query of the user is refetched: events may have been missed meanwhile.
 *
 * Mount inside the session, React Query, toast and navigation contexts.
 */
import { useQueryClient } from '@tanstack/react-query';
import { usePathname } from 'expo-router';
import { useEffect, useEffectEvent, useRef, type ReactNode } from 'react';

import { useToast } from '@/components/ui';
import { useSession } from '@/features/auth/session-provider';
import { useCurrentUser } from '@/hooks/queries/use-auth-queries';
import { queryKeys } from '@/hooks/queries/query-keys';
import { useNotificationPresenter } from '@/hooks/use-notification-presenter';
import { useOpenNotification } from '@/hooks/use-open-notification';
import { realtimeClient, type RealtimeEvent } from '@/services/realtime';
import type { AppNotification, NotificationPreferences } from '@/types/domain';

import { applyRealtimeEvent, getActiveConversationId, shouldPresentBanner } from './realtime-events';

const BANNER_DURATION_MS = 6000;

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { userId } = useSession();
  const toast = useToast();
  const pathname = usePathname();
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
    toast.show({
      id: `notification:${notification.id}`,
      title: content.title,
      message: content.body,
      tone: content.tone,
      icon: content.icon,
      onPress: () => openNotification(notification),
      durationMs: BANNER_DURATION_MS,
    });
  };

  const onRealtimeEvent = useEffectEvent((event: RealtimeEvent) => {
    if (!userId) return;
    applyRealtimeEvent(queryClient, userId, event);
    if (event.type === 'notification.created' && event.notification.userId === userId) {
      presentNotification(event.notification);
    }
  });

  const onReconnected = useEffectEvent(() => {
    if (userId) void queryClient.invalidateQueries({ queryKey: queryKeys.user(userId) });
  });

  // Realtime subscription for the signed-in user (the session lifecycle owns the connection).
  useEffect(() => {
    if (!userId) return undefined;
    const unsubscribeEvents = realtimeClient.subscribe((event) => onRealtimeEvent(event));
    const unsubscribeReconnect = realtimeClient.onReconnect(() => onReconnected());
    return () => {
      unsubscribeEvents();
      unsubscribeReconnect();
    };
  }, [userId]);

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
