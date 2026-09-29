/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Realtime → banner → navigation: a `notification.created` event shows an in-app banner through
 * the simulated push provider; tapping it marks the notification read and opens its target.
 */
import { Slot } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { getNotificationHref } from '@/features/notifications/notification-routing';
import { initI18n } from '@/i18n';
import { queryClient } from '@/lib/query-client';
import { createAccessToken } from '@/mocks/server/auth';
import { createTestEnvironment, type TestEnvironment } from '@/mocks/testing/test-server';
import { createMockTransport } from '@/mocks/transport';
import { AppProviders } from '@/providers/app-providers';
import { apiClient } from '@/services/api';
import { sessionStore } from '@/services/auth/session-store';
import type { RealtimeEvent } from '@/services/realtime/types';
import type { AppNotification, DemoAccount } from '@/types/domain';

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));

const mockRealtimeListeners = new Set<(event: RealtimeEvent) => void>();
jest.mock('@/services/realtime', () => ({
  realtimeClient: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    subscribe: (listener: (event: RealtimeEvent) => void) => {
      mockRealtimeListeners.add(listener);
      return () => mockRealtimeListeners.delete(listener);
    },
  },
}));

let env: TestEnvironment;
let customer: DemoAccount;

beforeAll(async () => {
  await initI18n('en');
  env = await createTestEnvironment();
  apiClient.setTransport(createMockTransport(env.server, { minLatencyMs: 0, maxLatencyMs: 0, failureRate: 0 }).transport);
  customer = (await env.as(null).auth.getDemoAccounts()).find((account) => account.role === 'customer')!;
});

afterEach(async () => {
  await sessionStore.signOut();
  queryClient.clear();
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
      'offers/[offerId]': () => <Text>Offer screen</Text>,
      'jobs/[jobId]': () => <Text>Job screen</Text>,
      'requests/[requestId]': () => <Text>Request screen</Text>,
      'conversations/[conversationId]': () => <Text>Chat screen</Text>,
      'professionals/[professionalId]/index': () => <Text>Profile screen</Text>,
      'professionals/[professionalId]/reviews': () => <Text>Reviews screen</Text>,
    },
    { initialUrl: '/' },
  );
}

describe('RealtimeProvider', () => {
  it('shows a banner for new notifications and opens the target on tap', async () => {
    await sessionStore.signIn(createAccessToken(customer.userId), { id: customer.userId, role: 'customer' });
    const customerApi = env.as(customer.userId);
    const { items } = await customerApi.notifications.getNotifications({ unreadOnly: true });
    const notification: AppNotification = items[0];
    const unreadBefore = (await customerApi.notifications.getUnreadCount()).count;

    const app = renderShell();
    await app;
    expect(await screen.findByText('Home')).toBeOnTheScreen();
    expect(mockRealtimeListeners.size).toBe(1);

    await act(async () => {
      mockRealtimeListeners.forEach((listener) => listener({ type: 'notification.created', notification }));
    });

    const banner = await screen.findByRole('button', { name: /\./ });
    await fireEvent.press(banner);

    const href = getNotificationHref(notification);
    await waitFor(() => expect(app.getPathname()).toBe(href));
    // Marked as read on the server.
    await waitFor(() => expect(queryClient.isMutating()).toBe(0));
    expect((await customerApi.notifications.getUnreadCount()).count).toBe(unreadBefore - 1);
  });

  it('does not show banners when the user turned them off', async () => {
    await sessionStore.signIn(createAccessToken(customer.userId), { id: customer.userId, role: 'customer' });
    const customerApi = env.as(customer.userId);
    const { profile } = await customerApi.customers.getCustomerProfile();
    await customerApi.customers.updateCustomerProfile({
      notificationPreferences: { ...profile.notificationPreferences, pushEnabled: false },
    });
    const { items } = await customerApi.notifications.getNotifications();

    const app = renderShell();
    await app;
    expect(await screen.findByText('Home')).toBeOnTheScreen();
    // Wait until `/me` (with the preferences) is loaded.
    await waitFor(() =>
      expect(queryClient.getQueryCache().findAll({ queryKey: ['u', customer.userId, 'me'] })[0]?.state.status).toBe('success'),
    );
    // React Query batches observer notifications with a timer; `renderRouter` uses fake timers.
    await act(async () => {
      await jest.runOnlyPendingTimersAsync();
    });

    await act(async () => {
      mockRealtimeListeners.forEach((listener) =>
        listener({ type: 'notification.created', notification: { ...items[0], id: 'ntf_fresh', readAt: null } }),
      );
    });
    expect(screen.queryByRole('button', { name: /\./ })).toBeNull();

    await customerApi.customers.updateCustomerProfile({ notificationPreferences: profile.notificationPreferences });
  });
});
