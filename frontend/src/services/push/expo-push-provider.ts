/**
 * Push notifications on iOS/Android with `expo-notifications` (Expo push service → APNs / FCM).
 *
 * - Foreground: the OS banner is suppressed (the realtime connection already shows the in-app
 *   banner); the notification still lands in the notification list.
 * - Android: one "default" channel (high importance). It is the manifest's default channel
 *   (app.json plugin option), which FCM uses since the server sends no channel id.
 * - The Expo push token is issued for the EAS project id (`EXPO_PUBLIC_EAS_PROJECT_ID`, or
 *   `extra.eas.projectId` from app.config.ts). Without it push is off (a warning in development).
 * - Taps: `data` is `{ notificationId, notificationType, target }` (see push-data.ts); the tap that
 *   launched the app is delivered once, when the first listener subscribes.
 */
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { env } from '@/config/env';
import { i18n } from '@/i18n';

import { parsePushTap } from './push-data';
import type { PushPermissionStatus, PushPlatform, PushProvider, PushTapListener } from './types';

export const ANDROID_CHANNEL_ID = 'default';

function resolveProjectId(): string | null {
  if (env.easProjectId) return env.easProjectId;
  const fromConfig: unknown = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  return typeof fromConfig === 'string' && fromConfig.length > 0 ? fromConfig : null;
}

function toStatus(permission: Notifications.NotificationPermissionsStatus): PushPermissionStatus {
  if (permission.granted) return 'granted';
  if (permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return 'granted';
  return permission.status === 'undetermined' ? 'undetermined' : 'denied';
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: i18n.t('notifications:channel.name'),
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
  });
}

/** The notification tap that launched the app (consumed), `null` when there is none. */
function readLaunchTap(): Notifications.NotificationResponse | null {
  try {
    const response = Notifications.getLastNotificationResponse();
    if (!response?.notification) return null;
    Notifications.clearLastNotificationResponse();
    return response;
  } catch {
    return null; // Not available (e.g. a build without the native module).
  }
}

export function createExpoPushProvider(platform: Exclude<PushPlatform, 'web'>): PushProvider {
  const projectId = resolveProjectId();
  if (!projectId && __DEV__) {
    console.warn('[push] EXPO_PUBLIC_EAS_PROJECT_ID is not set: push notifications are off.');
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });

  /** Taps already delivered (the launch tap can also arrive through the listener). */
  const handledTaps = new Set<string>();

  return {
    isSupported: projectId !== null,
    platform,
    async getPermissionStatus() {
      return toStatus(await Notifications.getPermissionsAsync());
    },
    async requestPermission() {
      // Android 13+ shows the permission dialog only once a channel exists.
      await ensureAndroidChannel();
      return toStatus(await Notifications.requestPermissionsAsync());
    },
    async getPushToken() {
      if (!projectId) return null;
      if (!Device.isDevice) {
        if (__DEV__) console.warn('[push] push tokens need a physical device.');
        return null;
      }
      try {
        await ensureAndroidChannel();
        return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      } catch (error) {
        // Missing FCM configuration (google-services.json), no network.
        if (__DEV__) console.warn('[push] no Expo push token', error);
        return null;
      }
    },
    onTokenChange(listener) {
      const subscription = Notifications.addPushTokenListener(() => listener());
      return () => subscription.remove();
    },
    onTap(listener: PushTapListener) {
      const handle = (response: Notifications.NotificationResponse) => {
        if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
        const id = response.notification.request.identifier;
        if (handledTaps.has(id)) return;
        handledTaps.add(id);
        const tap = parsePushTap(response.notification.request.content.data);
        if (tap) listener(tap);
      };
      const subscription = Notifications.addNotificationResponseReceivedListener(handle);
      const launchTap = readLaunchTap();
      if (launchTap) handle(launchTap);
      return () => subscription.remove();
    },
  };
}
