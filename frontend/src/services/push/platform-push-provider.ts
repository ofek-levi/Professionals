import { Platform } from 'react-native';

import { createExpoPushProvider } from './expo-push-provider';
import type { PushProvider } from './types';
import { createUnsupportedPushProvider } from './unsupported-push-provider';

/** iOS/Android: expo-notifications (the web build uses platform-push-provider.web.ts). */
export function createPlatformPushProvider(): PushProvider {
  return Platform.OS === 'ios' || Platform.OS === 'android' ? createExpoPushProvider(Platform.OS) : createUnsupportedPushProvider();
}
