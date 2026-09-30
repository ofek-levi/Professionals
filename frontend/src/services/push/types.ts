/**
 * Push notification abstraction: the app talks to a `PushProvider` (expo-notifications on
 * iOS/Android, an inert one on the web, which has no push).
 */
import type { NotificationTarget, NotificationType } from '@/types/domain';

export type PushPermissionStatus = 'granted' | 'denied' | 'undetermined';

/** Platform value sent to `POST /me/devices`. */
export type PushPlatform = 'ios' | 'android' | 'web';

/** The `data` object of every push the server sends (checked against the backend's `PushData`). */
export interface PushData {
  notificationId: string;
  notificationType: NotificationType;
  target: NotificationTarget;
}

/**
 * A tapped push notification, parsed from its `data` (`PushData`); the id and type are `null` when
 * missing or unknown to this app version.
 */
export interface PushTap {
  notificationId: string | null;
  notificationType: NotificationType | null;
  target: NotificationTarget;
}

export type PushTapListener = (tap: PushTap) => void;

export interface PushProvider {
  /** Push can work here (iOS/Android with an EAS project id); `false` on the web. */
  readonly isSupported: boolean;
  readonly platform: PushPlatform;
  getPermissionStatus(): Promise<PushPermissionStatus>;
  /** Asks the OS for permission (the system dialog, once). */
  requestPermission(): Promise<PushPermissionStatus>;
  /** The Expo push token (`ExponentPushToken[…]`) to register, `null` when unavailable. */
  getPushToken(): Promise<string | null>;
  /** The OS issued a new device token (register again). Returns an unsubscribe function. */
  onTokenChange(listener: () => void): () => void;
  /** The user tapped a notification, including the one that launched the app. */
  onTap(listener: PushTapListener): () => void;
}
