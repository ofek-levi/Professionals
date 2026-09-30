import type { PushProvider } from './types';
import { createUnsupportedPushProvider } from './unsupported-push-provider';

/** The web has no push: this keeps expo-notifications out of the web bundle. */
export function createPlatformPushProvider(): PushProvider {
  return createUnsupportedPushProvider();
}
