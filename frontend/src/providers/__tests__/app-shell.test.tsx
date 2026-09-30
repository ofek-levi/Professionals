/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * End-to-end check of the navigation shell with the real route tree (`src/app`) against the backend
 * test double: bootstrap, email sign-in, role guards, sign-out (server logout, realtime closed) and
 * the session's token refresh (proactive, reactive single-flight, failure → entry screen). The
 * app's own API client, token manager and WebSocket client run unchanged; only the transport and
 * the socket are the double's.
 */
import { act, cleanup, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';

import { emitMapMessage, findMapWebView, injectedMapMessages } from '@/components/__test-utils__/map-bridge';
import type { MapPageState } from '@/components/map/leaflet/map-protocol';
import { i18n } from '@/i18n';
import { queryClient } from '@/lib/query-client';
import { MAIN_CUSTOMER_IDS, PRO_IDS } from '@/test-utils/mock-backend/data/seed';
import { SEED_PASSWORD, SEED_CUSTOMER_EMAIL } from '@/test-utils/mock-backend/server/passwords';
import type { MockSocketServer } from '@/test-utils/mock-backend/socket-server';
import { createTestEnvironment, expectApiError, type TestEnvironment } from '@/test-utils/mock-backend/testing/test-server';
import { apiClient } from '@/services/api';
import { sessionStore } from '@/services/auth/session-store';

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));

// The app's WebSocket client with the app's token manager, connected to the double's socket server.
const mockSockets: { current: MockSocketServer | null } = { current: null };
jest.mock('@/services/realtime', () => {
  const { createWebSocketRealtimeClient } = jest.requireActual('@/services/realtime/websocket-realtime-client');
  const { sessionTokens } = jest.requireActual('@/services/api');
  return {
    realtimeClient: createWebSocketRealtimeClient({
      url: 'ws://localhost:4000/v1/realtime',
      auth: sessionTokens,
      openSocket: (url: string, protocols: string[], handlers: unknown) => mockSockets.current!.openSocket(url, protocols, handlers as never),
      appState: () => () => undefined,
    }),
  };
});

jest.setTimeout(30_000);

const customer = { userId: MAIN_CUSTOMER_IDS.noa };
const professional = { userId: PRO_IDS.avi };
let env: TestEnvironment;

beforeAll(() => {
  // `expo-router/testing-library` installs Reanimated's official mock, which lacks
  // `useReducedMotion` (used by skeletons).
  const reanimated = require('react-native-reanimated') as Record<string, unknown>;
  reanimated.useReducedMotion ??= () => false;

  // The app's token manager reads the device clock: the server clock starts there too.
  env = createTestEnvironment({ now: new Date() });
  apiClient.setTransport(env.transport);
  mockSockets.current = env.sockets;
});

afterEach(async () => {
  // Unmount first so signing out doesn't update a tree outside of `act`.
  await cleanup();
  await sessionStore.signOut();
  queryClient.clear();
  env.log.clear();
  // `renderRouter` switches to fake timers.
  jest.useRealTimers();
});

/** Requests the app sent, except the refresh itself (`[method path status]`). */
const appRequests = () => env.log.requests.filter((request) => request.path !== '/auth/refresh');

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
  it('signs in with email and password, guards roles and signs out', async () => {
    const app = await renderApp('/');

    // Signed out: the entry route redirects to the entry screen.
    expect(await screen.findByTestId('sign-in-screen', {}, { timeout: 10_000 })).toBeOnTheScreen();
    expect(app.getPathname()).toBe('/sign-in');

    await fireEvent.press(screen.getByTestId('entry-sign-in'));
    await waitFor(() => expect(app.getPathname()).toBe('/auth/login'), { timeout: 10_000 });
    await fireEvent.changeText(await screen.findByTestId('login-email'), SEED_CUSTOMER_EMAIL);
    await fireEvent.changeText(screen.getByTestId('login-password'), SEED_PASSWORD);
    await fireEvent.press(screen.getByTestId('login-submit'));

    await waitFor(() => expect(app.getPathname()).toBe('/customer/home'), { timeout: 10_000 });
    expect(sessionStore.getState()).toMatchObject({ status: 'signedIn', userId: customer.userId, role: 'customer' });
    // Signed in: the realtime socket is open for the new session.
    await waitFor(() => expect(env.sockets.open().map((socket) => socket.userId)).toEqual([customer.userId]), { timeout: 10_000 });
    const { refreshToken } = sessionStore.getTokens()!;

    // Customer tabs: Home · Requests · Inbox · Profile.
    expectTabs({ home: 'Home', requests: 'Requests', inbox: 'Inbox', profile: 'Profile' });

    // Profile tab → sign out → confirm → back to the entry screen.
    await navigate('/customer/profile');
    await fireEvent.press(await screen.findByTestId('account-sign-out', {}, { timeout: 10_000 }));
    const actions = await screen.findByTestId('confirm-dialog-actions', {}, { timeout: 10_000 });
    await fireEvent.press(within(actions).getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(app.getPathname()).toBe('/sign-in'), { timeout: 10_000 });
    expect(sessionStore.getState().status).toBe('signedOut');
    expect(sessionStore.getTokens()).toBeNull();

    // `POST /auth/logout { refreshToken }` ended the server session: the socket is closed and the
    // refresh token is dead.
    expect(env.log.to('/auth/logout', 'POST').map((request) => [request.body, request.status])).toEqual([[{ refreshToken }, 200]]);
    expect(env.log.to('/auth/logout')[0].headers.Authorization).toBeUndefined();
    await waitFor(() => expect(env.sockets.open()).toEqual([]), { timeout: 10_000 });
    // The socket was closed before the server ended the session: its 4001 did not make the app
    // spend the revoked refresh token, and signing out on purpose shows no "signed out" notice.
    expect(env.log.to('/auth/refresh')).toEqual([]);
    expect(screen.queryByText('You’ve been signed out')).toBeNull();
    expect(await expectApiError(env.as(null).auth.refresh({ refreshToken }))).toMatchObject({ status: 401 });
  });

  it('keeps the session when signing out is cancelled', async () => {
    await sessionStore.signIn(env.signIn(customer.userId));
    const app = await renderApp('/customer/profile');
    await fireEvent.press(await screen.findByTestId('account-sign-out', {}, { timeout: 10_000 }));
    const actions = await screen.findByTestId('confirm-dialog-actions', {}, { timeout: 10_000 });
    await fireEvent.press(within(actions).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByTestId('confirm-dialog-actions')).toBeNull(), { timeout: 10_000 });
    expect(app.getPathname()).toBe('/customer/profile');
    expect(sessionStore.getState().status).toBe('signedIn');
  });

  it('opens the professional tabs for a professional session', async () => {
    await sessionStore.signIn(env.signIn(professional.userId));
    const app = await renderApp('/');

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
    await sessionStore.signIn(env.signIn(customer.userId));
    const app = await renderApp('/professional/home');
    await waitFor(() => expect(app.getPathname()).toBe('/customer/home'), { timeout: 10_000 });
  });

  it('keeps signed-out users out of protected routes', async () => {
    const app = await renderApp('/settings');
    await waitFor(() => expect(app.getPathname()).toBe('/sign-in'), { timeout: 10_000 });
  });
});

describe('session tokens', () => {
  it('refreshes an expired access token once, before the first request', async () => {
    const session = env.signIn(customer.userId);
    await sessionStore.signIn({ ...session, accessTokenExpiresAt: new Date(Date.now() - 60_000).toISOString() });
    const app = await renderApp('/');

    await waitFor(() => expect(app.getPathname()).toBe('/customer/home'), { timeout: 10_000 });
    await waitFor(() => expect(appRequests().length).toBeGreaterThan(1), { timeout: 10_000 });
    // Exactly one refresh, and it came before everything else.
    expect(env.log.to('/auth/refresh')).toHaveLength(1);
    expect(env.log.requests[0]).toMatchObject({ path: '/auth/refresh', status: 200, body: { refreshToken: session.refreshToken } });
    expect(appRequests().every((request) => request.status < 400)).toBe(true);
    // The rotated refresh token was stored (the old one is now only good for the 30 s replay).
    expect(sessionStore.getTokens()?.refreshToken).not.toBe(session.refreshToken);
    expect(sessionStore.getState()).toMatchObject({ status: 'signedIn', userId: customer.userId });
  });

  it('answers concurrent 401s with one shared refresh and retries each request once', async () => {
    const session = env.signIn(customer.userId);
    // An access token the server refuses (e.g. its session was restored from an old backup).
    await sessionStore.signIn({ ...session, accessToken: 'access.forged.0.token' });
    const app = await renderApp('/');

    await waitFor(() => expect(app.getPathname()).toBe('/customer/home'), { timeout: 10_000 });
    await waitFor(() => expect(appRequests().filter((request) => request.status === 200).length).toBeGreaterThan(1), { timeout: 10_000 });
    const rejected = appRequests().filter((request) => request.status === 401);
    expect(rejected.length).toBeGreaterThan(1);
    expect(env.log.to('/auth/refresh')).toHaveLength(1);
    // Every rejected request was retried once with the refreshed token and succeeded.
    const fresh = sessionStore.getTokens()!.accessToken;
    for (const request of rejected) {
      const retries = appRequests().filter(
        (candidate) => candidate.method === request.method && candidate.path === request.path && candidate.headers.Authorization === `Bearer ${fresh}`,
      );
      expect(retries.length).toBeGreaterThan(0);
    }
    // The realtime socket was opened with the refreshed token, never with the refused one.
    await waitFor(() => expect(env.sockets.open().map((socket) => socket.userId)).toEqual([customer.userId]), { timeout: 10_000 });
  });

  it('signs out and shows the entry screen when the refresh token is rejected', async () => {
    const session = env.signIn(customer.userId);
    // The session was ended elsewhere (signed out on another device, password reset…).
    await env.as(null).auth.logout({ refreshToken: session.refreshToken });
    env.log.clear();
    await sessionStore.signIn(session);
    const app = await renderApp('/customer/home');

    await waitFor(() => expect(app.getPathname()).toBe('/sign-in'), { timeout: 10_000 });
    // The user is told why (not a silent jump to the entry screen).
    expect(await screen.findByText('You’ve been signed out')).toBeOnTheScreen();
    expect(screen.getByText('Your session has ended. Please sign in again.')).toBeOnTheScreen();
    expect(sessionStore.getState().status).toBe('signedOut');
    expect(sessionStore.getTokens()).toBeNull();
    expect(env.log.to('/auth/refresh').map((request) => request.status)).toEqual([401]);
    expect(queryClient.getQueryCache().findAll({ queryKey: ['u', customer.userId] })).toEqual([]);
    expect(env.sockets.open()).toEqual([]);
  });
});
