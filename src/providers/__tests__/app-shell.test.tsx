/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * End-to-end check of the navigation shell with the real route tree (`src/app`): bootstrap,
 * demo sign-in, role guards and sign-out, against a zero-latency in-app mock backend.
 */
import { act, cleanup, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { emitMapMessage, findMapWebView, injectedMapMessages } from '@/components/__test-utils__/map-bridge';
import type { MapPageState } from '@/components/map/leaflet/map-protocol';
import { i18n } from '@/i18n';
import { queryClient } from '@/lib/query-client';
import { createTestEnvironment } from '@/mocks/testing/test-server';
import { createMockTransport } from '@/mocks/transport';
import { apiClient } from '@/services/api';
import { sessionStore } from '@/services/auth/session-store';
import type { DemoAccount } from '@/types/domain';

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));

jest.setTimeout(30_000);

let customer: DemoAccount;
let professional: DemoAccount;

beforeAll(async () => {
  // `expo-router/testing-library` installs Reanimated's official mock, which lacks
  // `useReducedMotion` (used by skeletons).
  const reanimated = require('react-native-reanimated') as Record<string, unknown>;
  reanimated.useReducedMotion ??= () => false;

  const env = await createTestEnvironment();
  apiClient.setTransport(createMockTransport(env.server, { minLatencyMs: 0, maxLatencyMs: 0, failureRate: 0 }).transport);
  const accounts = await env.as(null).auth.getDemoAccounts();
  customer = accounts.find((account) => account.role === 'customer')!;
  professional = accounts.find((account) => account.role === 'professional')!;
});

afterEach(async () => {
  // Unmount first so signing out doesn't update a tree outside of `act`.
  await cleanup();
  await sessionStore.signOut();
  queryClient.clear();
  // `renderRouter` switches to fake timers.
  jest.useRealTimers();
});

afterAll(async () => {
  await i18n.changeLanguage('en');
});

async function renderApp(initialUrl = '/') {
  const result = renderRouter('./src/app', { initialUrl });
  // The testing library renders asynchronously; the router helpers live on the returned object.
  await result;
  return { getPathname: () => result.getPathname() };
}

function getRouter() {
  const { router } = require('expo-router') as typeof import('expo-router');
  return router;
}

async function navigate(href: string) {
  await act(async () => {
    getRouter().push(href as import('expo-router').Href);
  });
}

/** These bottom tabs are visible (by `tabBarButtonTestID`), with their labels. */
function expectTabs(tabs: Record<string, string>) {
  for (const [name, label] of Object.entries(tabs)) {
    expect(screen.getByTestId(`tab-${name}`)).toHaveTextContent(label, { exact: false });
  }
}

describe('app shell', () => {
  it('signs in with a demo account, guards roles and signs out', async () => {
    const app = await renderApp('/');

    // Signed out: the entry route redirects to the demo sign-in.
    expect(await screen.findByTestId('sign-in-screen', {}, { timeout: 10_000 })).toBeOnTheScreen();
    expect(app.getPathname()).toBe('/sign-in');

    // Pick the first demo customer.
    const card = await screen.findByTestId(`demo-account-${customer.userId}`, {}, { timeout: 10_000 });
    await fireEvent.press(card);

    await waitFor(() => expect(app.getPathname()).toBe('/customer/home'), { timeout: 10_000 });
    expect(sessionStore.getState()).toMatchObject({ status: 'signedIn', userId: customer.userId, role: 'customer' });

    // Customer tabs: Home · Requests · Inbox · Profile.
    expectTabs({ home: 'Home', requests: 'Requests', inbox: 'Inbox', profile: 'Profile' });

    // Profile tab → sign out (no confirmation) → back to the sign-in screen.
    await navigate('/customer/profile');
    const signOut = await screen.findAllByRole('button', { name: /^Sign out/ }, { timeout: 10_000 });
    await fireEvent.press(signOut[0]);
    await waitFor(() => expect(app.getPathname()).toBe('/sign-in'), { timeout: 10_000 });
    expect(sessionStore.getState().status).toBe('signedOut');
  });

  it('lists professional demo accounts and opens the professional tabs', async () => {
    const app = await renderApp('/sign-in');
    await screen.findByTestId(`demo-account-${customer.userId}`, {}, { timeout: 10_000 });
    expect(screen.queryByTestId(`demo-account-${professional.userId}`)).toBeNull();

    await fireEvent.press(screen.getByRole('tab', { name: /^Professional/ }));
    await fireEvent.press(await screen.findByTestId(`demo-account-${professional.userId}`));

    await waitFor(() => expect(app.getPathname()).toBe('/professional/home'), { timeout: 10_000 });
    expect(sessionStore.getState().role).toBe('professional');

    // Professional tabs: Home · Explore · Work · Inbox · Profile.
    expectTabs({ home: 'Home', explore: 'Explore', work: 'Work', inbox: 'Inbox', profile: 'Profile' });

    // Explore opens on the map: the service-area circle and a marker per nearby job.
    await navigate('/professional/explore');
    const map = await findMapWebView('map-webview', 10_000);
    await emitMapMessage(map, { type: 'ready' });
    await waitFor(
      () => {
        const state = injectedMapMessages().filter((message) => message.type === 'state').pop()?.state as MapPageState | undefined;
        expect(state?.circles[0]?.id).toBe('service-area');
        expect(state?.markers.length).toBeGreaterThan(0);
      },
      { timeout: 10_000 },
    );
  });

  it('redirects a customer away from professional screens', async () => {
    await sessionStore.signIn(`demo-token:${customer.userId}`, { id: customer.userId, role: 'customer' });
    const app = await renderApp('/professional/home');
    await waitFor(() => expect(app.getPathname()).toBe('/customer/home'), { timeout: 10_000 });
  });

  it('keeps signed-out users out of protected routes', async () => {
    const app = await renderApp('/settings');
    await waitFor(() => expect(app.getPathname()).toBe('/sign-in'), { timeout: 10_000 });
  });
});
