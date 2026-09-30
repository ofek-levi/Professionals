/**
 * Push notifications entry point: the platform's provider (expo-notifications on iOS/Android,
 * none on the web) and the device registration against the API.
 */
import { api } from '@/services/api';

import { createPlatformPushProvider } from './platform-push-provider';
import { createPushRegistration } from './push-registration';
import type { PushProvider } from './types';

export const pushProvider: PushProvider = createPlatformPushProvider();

export const pushRegistration = createPushRegistration({
  provider: pushProvider,
  register: (payload) => api.users.registerDevice(payload),
  unregister: (pushToken) => api.users.unregisterDevice(pushToken),
});

export type { PushRegistrationResult } from './push-registration';
export type { PushPermissionStatus, PushPlatform, PushProvider, PushTap } from './types';
