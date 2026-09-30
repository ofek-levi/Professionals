/**
 * Device registration for push (`POST /me/devices { pushToken, platform }`): asks for permission
 * when allowed to, registers the Expo push token and registers again whenever the OS issues a new
 * one. Signing out needs no call: the server's logout removes the session's devices (it is queued
 * until the server confirms it, `services/auth/pending-logouts.ts`), and push fan-out skips devices
 * whose session has ended (expired or revoked without a logout);
 * `unregister()` is for turning push off in Settings (`DELETE /me/devices/:token`).
 */
import type { RegisterDeviceRequest } from '@/types/api';

import type { PushPermissionStatus, PushProvider } from './types';

export interface PushRegistrationDeps {
  provider: PushProvider;
  register: (payload: RegisterDeviceRequest) => Promise<unknown>;
  unregister: (pushToken: string) => Promise<unknown>;
}

export type PushRegistrationResult = 'registered' | 'unsupported' | PushPermissionStatus | 'failed';

export interface PushRegistration {
  /**
   * Registers this device (asking for permission first when `askPermission` and it was never
   * asked) and keeps it registered when the token changes. Returns a stop function.
   */
  start(options: { askPermission: boolean }): () => void;
  /** Registers once; resolves why not when it could not. Never throws. */
  register(options: { askPermission: boolean }): Promise<PushRegistrationResult>;
  /** Stops push to this device (best effort). */
  unregister(): Promise<void>;
}

export function createPushRegistration({ provider, register, unregister }: PushRegistrationDeps): PushRegistration {
  let registeredToken: string | null = null;

  const registerOnce: PushRegistration['register'] = async ({ askPermission }) => {
    if (!provider.isSupported) return 'unsupported';
    try {
      let status = await provider.getPermissionStatus();
      if (status === 'undetermined' && askPermission) status = await provider.requestPermission();
      if (status !== 'granted') return status;
      const pushToken = await provider.getPushToken();
      if (!pushToken) return 'failed';
      await register({ pushToken, platform: provider.platform });
      registeredToken = pushToken;
      return 'registered';
    } catch (error) {
      if (__DEV__) console.warn('[push] device registration failed', error);
      return 'failed';
    }
  };

  return {
    start({ askPermission }) {
      if (!provider.isSupported) return () => undefined;
      const stopTokenListener = provider.onTokenChange(() => void registerOnce({ askPermission: false }));
      void registerOnce({ askPermission });
      return stopTokenListener;
    },
    register: registerOnce,
    async unregister() {
      if (!provider.isSupported) return;
      try {
        const pushToken = registeredToken ?? (await provider.getPushToken());
        if (pushToken) await unregister(pushToken);
        registeredToken = null;
      } catch (error) {
        if (__DEV__) console.warn('[push] device unregistration failed', error);
      }
    },
  };
}
