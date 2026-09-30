/**
 * Signing out and in against the backend test double: signing out ends the session locally at
 * once, then sends the session's refresh token to `POST /auth/logout` (the server drops the
 * session and its push devices); a logout the server did not confirm stays queued and is sent
 * again later. Signing in syncs the account language (`PATCH /me`).
 */
import { renderHook } from '@testing-library/react-native';

import { syncAccountLanguage } from '@/features/settings/account-language';
import { i18n, initI18n } from '@/i18n';
import { apiClient } from '@/services/api';
import { sessionStore } from '@/services/auth/session-store';
import type { Transport, TransportResponse } from '@/services/api/transport';
import { realtimeClient } from '@/services/realtime';
import { MAIN_CUSTOMER_IDS } from '@/test-utils/mock-backend/data/seed';
import { createTestEnvironment, expectApiError, type TestEnvironment } from '@/test-utils/mock-backend/testing/test-server';

import { establishSession, pendingLogouts, useAuthActions } from '../session-provider';

const NOA = MAIN_CUSTOMER_IDS.noa;

let env: TestEnvironment;
let signOut: () => Promise<void>;

beforeAll(async () => {
  await initI18n('en');
  env = createTestEnvironment({ now: new Date() });
  const { result } = await renderHook(() => useAuthActions());
  signOut = result.current.signOut;
});

beforeEach(async () => {
  apiClient.setTransport(env.transport);
  await sessionStore.signOut();
  for (const token of await pendingLogouts.pending()) await pendingLogouts.discard(token);
  env.log.clear();
});

afterEach(() => {
  jest.useRealTimers();
});

afterAll(async () => {
  await i18n.changeLanguage('en');
});

describe('signOut', () => {
  it('sends POST /auth/logout with the refresh token (no bearer), and the server ends the session and its devices', async () => {
    const session = env.signIn(NOA);
    await sessionStore.signIn(session);
    await apiClient.post('/me/devices', { pushToken: 'ExponentPushToken[noa-phone]', platform: 'ios' });
    expect(env.server.internals.db.devices.filter((device) => device.userId === NOA)).toHaveLength(1);

    await signOut();
    await pendingLogouts.flush();

    const [logout] = env.log.to('/auth/logout', 'POST');
    expect(logout).toMatchObject({ body: { refreshToken: session.refreshToken }, status: 200 });
    expect(logout.headers.Authorization).toBeUndefined();
    expect(sessionStore.getState().status).toBe('signedOut');
    expect(sessionStore.getTokens()).toBeNull();
    expect(env.server.internals.db.devices.filter((device) => device.userId === NOA)).toEqual([]);
    expect(await expectApiError(env.as(null).auth.refresh({ refreshToken: session.refreshToken }))).toMatchObject({ status: 401 });
    expect(await pendingLogouts.pending()).toEqual([]);
  });

  it('closes the realtime connection before the server ends the session (its 4001 must not trigger a refresh)', async () => {
    await sessionStore.signIn(env.signIn(NOA));
    const order: string[] = [];
    const disconnect = jest.spyOn(realtimeClient, 'disconnect').mockImplementation(() => {
      order.push('realtime closed');
    });
    const connect = jest.spyOn(realtimeClient, 'connect');
    apiClient.setTransport((request) => {
      order.push(`${request.method} ${request.path}`);
      return env.transport(request);
    });
    try {
      await signOut();
      await pendingLogouts.flush();
      expect(order[0]).toBe('realtime closed');
      expect(order).toContain('POST /auth/logout');
      expect(order).not.toContain('POST /auth/refresh');
      expect(connect).not.toHaveBeenCalled();
    } finally {
      disconnect.mockRestore();
      connect.mockRestore();
    }
  });

  it('reconnects realtime when the local sign-out fails (still signed in)', async () => {
    await sessionStore.signIn(env.signIn(NOA));
    const disconnect = jest.spyOn(realtimeClient, 'disconnect').mockImplementation(() => undefined);
    const connect = jest.spyOn(realtimeClient, 'connect').mockImplementation(() => undefined);
    const localSignOut = jest.spyOn(sessionStore, 'signOut').mockRejectedValueOnce(new Error('storage'));
    try {
      await expect(signOut()).rejects.toThrow('storage');
      expect(disconnect).toHaveBeenCalled();
      expect(connect).toHaveBeenCalledTimes(1);
      // The session continues: its logout is not queued.
      expect(await pendingLogouts.pending()).toEqual([]);
      expect(env.log.to('/auth/logout', 'POST')).toEqual([]);
    } finally {
      disconnect.mockRestore();
      connect.mockRestore();
      localSignOut.mockRestore();
    }
  });

  it('signs out locally at once and retries the server logout later when the server cannot be reached', async () => {
    const session = env.signIn(NOA);
    await sessionStore.signIn(session);
    await apiClient.post('/me/devices', { pushToken: 'ExponentPushToken[noa-offline]', platform: 'android' });
    const offline: Transport = async () => ({ status: 0, data: { code: 'NETWORK_ERROR', message: 'offline' } });
    apiClient.setTransport(offline);

    await signOut();
    await pendingLogouts.flush();
    expect(sessionStore.getState().status).toBe('signedOut');
    // Still owed: the session (and its push device) would otherwise live on for 90 days.
    expect(await pendingLogouts.pending()).toEqual([session.refreshToken]);
    expect(env.server.internals.db.devices.filter((device) => device.userId === NOA)).toHaveLength(1);

    // Back online (next launch, foreground, sign-in): sent again and forgotten once confirmed.
    apiClient.setTransport(env.transport);
    await pendingLogouts.flush();
    expect(env.log.to('/auth/logout', 'POST')).toEqual([expect.objectContaining({ body: { refreshToken: session.refreshToken }, status: 200 })]);
    expect(env.server.internals.db.devices.filter((device) => device.userId === NOA)).toEqual([]);
    expect(await pendingLogouts.pending()).toEqual([]);
  });

  it('never waits for a slow server; a 5xx answer keeps the logout queued', async () => {
    const session = env.signIn(NOA);
    await sessionStore.signIn(session);
    let answer: (response: TransportResponse) => void = () => undefined;
    apiClient.setTransport(() => new Promise((resolve) => (answer = resolve)));
    await signOut();
    expect(sessionStore.getState().status).toBe('signedOut');
    expect(await pendingLogouts.pending()).toEqual([session.refreshToken]);

    answer({ status: 503, data: { code: 'SERVICE_UNAVAILABLE', message: 'busy' } });
    await pendingLogouts.flush();
    expect(await pendingLogouts.pending()).toEqual([session.refreshToken]);
  });

  it('sends nothing when already signed out', async () => {
    await signOut();
    expect(env.log.requests).toEqual([]);
  });
});

describe('account language', () => {
  it('signing in with another language than the account’s updates it (PATCH /me)', async () => {
    await i18n.changeLanguage('he');
    const session = env.signIn(NOA);
    await establishSession({ ...session, user: { ...session.user, preferredLanguage: 'en' } });
    await waitForRequests('/me', 'PATCH');
    expect(env.log.to('/me', 'PATCH')[0].body).toEqual({ preferredLanguage: 'he' });
    expect(env.server.internals.db.users.require(NOA, 'User').preferredLanguage).toBe('he');
    await i18n.changeLanguage('en');
  });

  it('does nothing when the languages match or when signed out', async () => {
    await syncAccountLanguage('en', 'en');
    await syncAccountLanguage('he');
    await sessionStore.signIn(env.signIn(NOA));
    await syncAccountLanguage('en', 'en');
    expect(env.log.to('/me', 'PATCH')).toEqual([]);
  });

  it('never blocks a language switch for more than 3 seconds', async () => {
    await sessionStore.signIn(env.signIn(NOA));
    jest.useFakeTimers();
    apiClient.setTransport(() => new Promise(() => undefined));
    const done = syncAccountLanguage('he', 'en');
    await jest.advanceTimersByTimeAsync(3_000);
    await expect(done).resolves.toBeUndefined();
  });
});

async function waitForRequests(path: string, method: 'PATCH' | 'POST') {
  for (let i = 0; i < 20 && env.log.to(path, method).length === 0; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
}
