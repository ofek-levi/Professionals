import type { PushProvider } from './types';

/** The web has no push notifications (the realtime connection shows in-app banners instead). */
export function createUnsupportedPushProvider(): PushProvider {
  const noop = () => () => undefined;
  return {
    isSupported: false,
    platform: 'web',
    getPermissionStatus: async () => 'denied',
    requestPermission: async () => 'denied',
    getPushToken: async () => null,
    onTokenChange: noop,
    onTap: noop,
  };
}
