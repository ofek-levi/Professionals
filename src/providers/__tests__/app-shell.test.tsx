/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * End-to-end check of the navigation shell with the real route tree (`src/app`): bootstrap,
 * demo sign-in, role guards and sign-out, against a zero-latency in-app mock backend.
 */
import { act, cleanup, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { i18n } from '@/i18n';
import { queryClient } from '@/lib/query-client';
import { createTestEnvironment } from '@/mocks/testing/test-server';
import { createMockTransport } from '@/mocks/transport';
import { apiClient } from '@/services/api';
import { sessionStore } from '@/services/auth/session-store';
import type { DemoAccount } from '@/types/domain';

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-maps', () => require('@/components/map/react-native-maps.mock'));

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

    // Settings → sign out (confirmed) → back to the sign-in screen.
    const { router } = require('expo-router') as typeof import('expo-router');
    await act(async () => {
      router.push('/settings');
    });
    expect(await screen.findByTestId('settings-screen')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByText('Sign out?')).toBeOnTheScreen();
    const signOutButtons = screen.getAllByRole('button', { name: 'Sign out' });
    await fireEvent.press(signOutButtons[signOutButtons.length - 1]);
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
