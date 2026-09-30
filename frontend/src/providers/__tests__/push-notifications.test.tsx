/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Push while signed in, against the backend test double: the device is registered
 * (`POST /me/devices`) a moment after the signed-in home renders, again when the OS issues a new
 * token, never when the account turned push off; a tapped notification is marked read and opens
 * its target (a tap without an id routes by its target).
 */
import { Slot } from 'expo-router';
import { act, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { getNotificationHref } from '@/features/notifications/notification-routing';
import { initI18n } from '@/i18n';
import { queryClient } from '@/lib/query-client';
import { AppProviders } from '@/providers/app-providers';
import { apiClient } from '@/services/api';
import { sessionStore } from '@/services/auth/session-store';
import type { PushPermissionStatus, PushTap } from '@/services/push';
import { MAIN_CUSTOMER_IDS, SEED_IDS } from '@/test-utils/mock-backend/data/seed';
import { createTestEnvironment, type TestEnvironment } from '@/test-utils/mock-backend/testing/test-server';

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));

jest.mock('@/services/realtime', () => ({
  realtimeClient: { connect: jest.fn(), disconnect: jest.fn(), subscribe: () => () => undefined, onReconnect: () => () => undefined },
}));

/** The device: OS permission, its Expo token, and the listeners the app registered. */
const mockDevice = {
  permission: 'undetermined' as PushPermissionStatus,
  token: 'ExponentPushToken[noa-phone]',
  prompts: 0,
  tokenListeners: new Set<() => void>(),
  tapListeners: new Set<(tap: PushTap) => void>(),
};

// The app's registration logic with a device-shaped provider (expo-notifications is native).
jest.mock('@/services/push', () => {
  const { createPushRegistration } = jest.requireActual('@/services/push/push-registration');
  const { api } = jest.requireActual('@/services/api');
  const provider = {
    isSupported: true,
    platform: 'ios',
    getPermissionStatus: async () => mockDevice.permission,
    requestPermission: async () => {
      mockDevice.prompts += 1;
      mockDevice.permission = 'granted';
      return mockDevice.permission;
    },
    getPushToken: async () => mockDevice.token,
    onTokenChange: (listener: () => void) => {
      mockDevice.tokenListeners.add(listener);
      return () => mockDevice.tokenListeners.delete(listener);
    },
    onTap: (listener: (tap: PushTap) => void) => {
      mockDevice.tapListeners.add(listener);
      return () => mockDevice.tapListeners.delete(listener);
    },
  };
  return {
    pushProvider: provider,
    pushRegistration: createPushRegistration({
      provider,
      register: (payload: unknown) => api.users.registerDevice(payload),
      unregister: (pushToken: string) => api.users.unregisterDevice(pushToken),
    }),
  };
});

const NOA = MAIN_CUSTOMER_IDS.noa;
let env: TestEnvironment;

beforeAll(async () => {
  await initI18n('en');
  env = createTestEnvironment({ now: new Date() });
  apiClient.setTransport(env.transport);
});

beforeEach(() => {
  mockDevice.permission = 'undetermined';
  mockDevice.token = 'ExponentPushToken[noa-phone]';
  mockDevice.prompts = 0;
});

afterEach(async () => {
  await sessionStore.signOut();
  queryClient.clear();
  env.log.clear();
  jest.useRealTimers();
});

function renderShell() {
  return renderRouter(
    {
      _layout: () => (
        <AppProviders>
          <Slot />
        </AppProviders>
      ),
      index: () => <Text>Home</Text>,
      'jobs/[jobId]': () => <Text>Job screen</Text>,
      'requests/[requestId]': () => <Text>Request screen</Text>,
      'conversations/[conversationId]': () => <Text>Chat screen</Text>,
      'professionals/[professionalId]/index': () => <Text>Profile screen</Text>,
      'professionals/[professionalId]/reviews': () => <Text>Reviews screen</Text>,
    },
    { initialUrl: '/' },
  );
}

const devicesOf = (userId: string) =>
  env.server.internals.db.devices.filter((device) => device.userId === userId).map(({ pushToken, platform }) => ({ pushToken, platform }));

/** Lets the provider's permission delay (1.5 s) pass and the registration finish. */
async function passPermissionDelay() {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(2000);
  });
}

describe('PushNotifications', () => {
  it('registers the device a moment after sign-in, and again when the OS issues a new token', async () => {
    await sessionStore.signIn(env.signIn(NOA));
    await renderShell();
    expect(await screen.findByText('Home')).toBeOnTheScreen();
    expect(mockDevice.prompts).toBe(0); // not before the home is up

    await passPermissionDelay();
    await waitFor(() => expect(devicesOf(NOA)).toEqual([{ pushToken: 'ExponentPushToken[noa-phone]', platform: 'ios' }]));
    expect(mockDevice.prompts).toBe(1);
    // Registered with the session's own token: signing out will remove it.
    const [device] = env.server.internals.db.devices.filter((row) => row.userId === NOA);
    expect(env.server.internals.db.sessions.get(device.sessionId)?.userId).toBe(NOA);

    mockDevice.token = 'ExponentPushToken[noa-phone-rotated]';
    await act(async () => {
      mockDevice.tokenListeners.forEach((listener) => listener());
    });
    await waitFor(() =>
      expect(env.log.to('/me/devices', 'POST').map((request) => (request.body as { pushToken: string }).pushToken)).toEqual([
        'ExponentPushToken[noa-phone]',
        'ExponentPushToken[noa-phone-rotated]',
      ]),
    );
    expect(mockDevice.prompts).toBe(1);
  });

  it('does not register (or ask) when the account turned push notifications off', async () => {
    const noa = env.as(NOA);
    const { profile } = await noa.customers.getCustomerProfile();
    await noa.customers.updateCustomerProfile({ notificationPreferences: { ...profile.notificationPreferences, pushEnabled: false } });
    try {
      await sessionStore.signIn(env.signIn(NOA));
      await renderShell();
      expect(await screen.findByText('Home')).toBeOnTheScreen();
      await waitFor(() =>
        expect(queryClient.getQueryCache().findAll({ queryKey: ['u', NOA, 'me'] })[0]?.state.status).toBe('success'),
      );
      await passPermissionDelay();
      expect(env.log.to('/me/devices')).toEqual([]);
      expect(mockDevice.prompts).toBe(0);
    } finally {
      await noa.customers.updateCustomerProfile({ notificationPreferences: profile.notificationPreferences });
    }
  });

  it('marks a tapped notification read and opens its target', async () => {
    const noa = env.as(NOA);
    const { items } = await noa.notifications.getNotifications({ unreadOnly: true });
    const notification = items.find((item) => getNotificationHref(item) !== null)!;
    const unreadBefore = (await noa.notifications.getUnreadCount()).count;
    await sessionStore.signIn(env.signIn(NOA));
    const app = renderShell();
    await app;
    expect(await screen.findByText('Home')).toBeOnTheScreen();

    await act(async () => {
      mockDevice.tapListeners.forEach((listener) =>
        listener({ notificationId: notification.id, notificationType: notification.type, target: notification.target }),
      );
    });
    await waitFor(() => expect(app.getPathname()).toBe(getNotificationHref(notification)));
    await waitFor(() => expect(env.log.to(`/notifications/${notification.id}/read`, 'POST')).toHaveLength(1));
    expect((await noa.notifications.getUnreadCount()).count).toBe(unreadBefore - 1);
  });

  it('routes a tap without a notification id by its target, and ignores taps while signed out', async () => {
    await sessionStore.signIn(env.signIn(NOA));
    const app = renderShell();
    await app;
    expect(await screen.findByText('Home')).toBeOnTheScreen();
    await act(async () => {
      mockDevice.tapListeners.forEach((listener) =>
        listener({ notificationId: null, notificationType: null, target: { kind: 'job', jobId: SEED_IDS.jobs.noaLighting } }),
      );
    });
    await waitFor(() => expect(app.getPathname()).toBe(`/jobs/${SEED_IDS.jobs.noaLighting}`));
    expect(env.log.requests.filter((request) => request.path.startsWith('/notifications/') && request.method === 'POST')).toEqual([]);

    await act(async () => {
      await sessionStore.signOut();
    });
    await act(async () => {
      mockDevice.tapListeners.forEach((listener) =>
        listener({ notificationId: null, notificationType: null, target: { kind: 'conversation', conversationId: SEED_IDS.conversations.noaLighting } }),
      );
    });
    expect(app.getPathname()).not.toBe(`/conversations/${SEED_IDS.conversations.noaLighting}`);
  });
});
