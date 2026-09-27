/**
 * Push notifications entry point.
 *
 * `pushProvider` is the simulated in-app provider (banners through the toast host). Once
 * `expo-notifications` is installed, switch to `createExpoPushProvider()` for real pushes – the
 * rest of the app only depends on the `PushProvider` interface.
 */
import { Platform } from 'react-native';

import { api } from '@/services/api';

import { createSimulatedPushProvider } from './simulated-push-provider';
import type { PushPlatform, PushProvider } from './types';

export const pushProvider = createSimulatedPushProvider();

export function getPushPlatform(): PushPlatform {
  if (Platform.OS === 'ios' || Platform.OS === 'android') return Platform.OS;
  return 'web';
}

/**
 * Asks for permission (when needed), obtains the device token and registers it for the signed-in
 * user with `POST /me/devices`. Never throws; resolves `true` when the device was registered.
 */
export async function registerDeviceForPush(provider: PushProvider = pushProvider): Promise<boolean> {
  try {
    const current = await provider.getPermissionStatus();
    const status = current === 'undetermined' ? await provider.requestPermission() : current;
    if (status !== 'granted') return false;
    const pushToken = await provider.getDeviceToken();
    if (!pushToken) return false;
    await api.auth.registerDevice({ pushToken, platform: getPushPlatform() });
    return true;
  } catch (error) {
    if (__DEV__) console.warn('[push] device registration failed', error);
    return false;
  }
}

export { createExpoPushProvider } from './expo-push-provider';
export { createSimulatedPushProvider, type PushBannerPresenter, type SimulatedPushProvider } from './simulated-push-provider';
export type { PushListener, PushMessage, PushPermissionStatus, PushPlatform, PushProvider } from './types';
