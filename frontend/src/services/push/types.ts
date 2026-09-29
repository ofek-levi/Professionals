/**
 * Push notification abstraction. The app talks to a `PushProvider`; today it is the simulated
 * in-app provider, later an `expo-notifications` based one (see `expo-push-provider.ts`).
 */
import type { StatusTone } from '@/constants/tones';
import type { NotificationTarget, NotificationType } from '@/types/domain';

export type PushPermissionStatus = 'granted' | 'denied' | 'undetermined';

/** Platform value sent to `POST /me/devices`. */
export type PushPlatform = 'ios' | 'android' | 'web';

/** A push message as the app sees it (already localized for display). */
export interface PushMessage {
  /** Stable id – the server notification id when there is one. */
  id: string;
  title: string;
  body?: string;
  /** MaterialCommunityIcons glyph for in-app banners. */
  icon?: string;
  tone?: StatusTone;
  /** Where tapping the notification should navigate. */
  target: NotificationTarget;
  /** Server notification id and type (used to mark it as read and route precisely on tap). */
  notificationId?: string;
  notificationType?: NotificationType;
}

export type PushListener = (message: PushMessage) => void;

export interface PushProvider {
  readonly kind: 'simulated' | 'expo';
  getPermissionStatus(): Promise<PushPermissionStatus>;
  /** Asks the OS for permission (no-op for the simulated provider). */
  requestPermission(): Promise<PushPermissionStatus>;
  /** Device push token to register with the backend, or `null` when unavailable. */
  getDeviceToken(): Promise<string | null>;
  /** A notification arrived while the app is running. */
  onNotification(listener: PushListener): () => void;
  /** The user tapped a notification (system tray or in-app banner). */
  onNotificationResponse(listener: PushListener): () => void;
}
