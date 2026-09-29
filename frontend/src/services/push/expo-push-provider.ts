/**
 * Placeholder for the production push provider built on `expo-notifications`.
 *
 * `expo-notifications` is intentionally NOT installed yet, so this module must not import it.
 * It documents the contract a real implementation fulfils and returns an inert provider, so the
 * rest of the app can already be written against `PushProvider`.
 *
 * Enabling real push notifications:
 *  1. `npx expo install expo-notifications expo-device` and add `"expo-notifications"` to the
 *     `plugins` in app.json (icon/color for Android). Configure APNs/FCM credentials with EAS.
 *  2. Implement the methods below:
 *     - `getPermissionStatus` / `requestPermission` → `Notifications.getPermissionsAsync()` /
 *       `Notifications.requestPermissionsAsync()` (map `status` to `PushPermissionStatus`).
 *     - `getDeviceToken` → `Notifications.getExpoPushTokenAsync({ projectId })` (only on a physical
 *       device, `Device.isDevice`), or `getDevicePushTokenAsync()` for direct FCM/APNs delivery.
 *     - `onNotification` → `Notifications.addNotificationReceivedListener`.
 *     - `onNotificationResponse` → `Notifications.addNotificationResponseReceivedListener` (also
 *       check `getLastNotificationResponseAsync()` on launch for cold starts).
 *     Map `notification.request.content` to `PushMessage`; the backend should put
 *     `{ notificationId, target }` (a `NotificationTarget`) into the payload's `data`.
 *  3. Call `Notifications.setNotificationHandler` so foreground pushes are not shown twice (the
 *     in-app banner already covers the foreground case).
 *  4. Use this provider as `pushProvider` in ./index.ts when `apiConfig.mode === 'http'`.
 */
import type { PushProvider } from './types';

export function createExpoPushProvider(): PushProvider {
  const noop = () => () => undefined;
  return {
    kind: 'expo',
    getPermissionStatus: async () => 'undetermined',
    requestPermission: async () => 'denied',
    getDeviceToken: async () => null,
    onNotification: noop,
    onNotificationResponse: noop,
  };
}
