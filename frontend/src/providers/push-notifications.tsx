/**
 * Push notifications while signed in (iOS/Android; nothing happens on the web):
 * - registers this device (`POST /me/devices`) while the account has push on
 *   (`notificationPreferences.pushEnabled`), asking for permission a moment after sign-in, when
 *   the home screen is up (never on the entry screens), and again whenever the OS issues a new
 *   token. Signing out needs nothing: the server's logout removes the session's devices;
 * - a tapped notification (also the one that launched the app) is marked read and opens its
 *   target, like a tap in the inbox.
 *
 * Render after the navigator (a launch tap navigates right away).
 */
import { useRouter } from 'expo-router';
import { useEffect, useEffectEvent } from 'react';

import { useSession } from '@/features/auth/session-provider';
import { notificationTargetToHref } from '@/features/notifications/notification-routing';
import { useCurrentUser } from '@/hooks/queries/use-auth-queries';
import { useOpenNotification } from '@/hooks/use-open-notification';
import { pushProvider, pushRegistration, type PushTap } from '@/services/push';

/** Lets the signed-in home render before the system permission dialog appears. */
const PERMISSION_PROMPT_DELAY_MS = 1500;

export function PushNotifications() {
  const router = useRouter();
  const { userId } = useSession();
  const currentUser = useCurrentUser();
  const openNotification = useOpenNotification();
  const pushEnabled =
    currentUser.data?.customerProfile?.notificationPreferences.pushEnabled ??
    currentUser.data?.professionalProfile?.notificationPreferences.pushEnabled;

  useEffect(() => {
    if (!userId || pushEnabled !== true || !pushProvider.isSupported) return undefined;
    let stop: (() => void) | null = null;
    const timer = setTimeout(() => {
      stop = pushRegistration.start({ askPermission: true });
    }, PERMISSION_PROMPT_DELAY_MS);
    return () => {
      clearTimeout(timer);
      stop?.();
    };
  }, [userId, pushEnabled]);

  const onTap = useEffectEvent((tap: PushTap) => {
    if (!userId) return;
    const { notificationId, notificationType, target } = tap;
    if (notificationId && notificationType) {
      openNotification({ id: notificationId, type: notificationType, target, readAt: null });
      return;
    }
    const href = notificationTargetToHref(target);
    if (href) router.push(href);
  });

  useEffect(() => pushProvider.onTap((tap) => onTap(tap)), []);

  return null;
}
