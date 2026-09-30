/**
 * Signing out and in against the backend test double: logout sends the session's refresh token
 * (best effort, bounded to 5 s) and always ends the session locally; the server then drops the
 * session and its push devices. Signing in syncs the account language (`PATCH /me`).
 */
import { renderHook } from '@testing-library/react-native';

import { syncAccountLanguage } from '@/features/settings/account-language';
import { i18n, initI18n } from '@/i18n';
import { apiClient } from '@/services/api';
import { sessionStore } from '@/services/auth/session-store';
import type { Transport } from '@/services/api/transport';
import { MAIN_CUSTOMER_IDS } from '@/test-utils/mock-backend/data/seed';
import { createTestEnvironment, expectApiError, type TestEnvironment } from '@/test-utils/mock-backend/testing/test-server';

import { establishSession, useAuthActions } from '../session-provider';

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

    const [logout] = env.log.to('/auth/logout', 'POST');
    expect(logout).toMatchObject({ body: { refreshToken: session.refreshToken }, status: 200 });
    expect(logout.headers.Authorization).toBeUndefined();
    expect(sessionStore.getState().status).toBe('signedOut');
    expect(sessionStore.getTokens()).toBeNull();
    expect(env.server.internals.db.devices.filter((device) => device.userId === NOA)).toEqual([]);
    expect(await expectApiError(env.as(null).auth.refresh({ refreshToken: session.refreshToken }))).toMatchObject({ status: 401 });
  });

  it('still signs out locally when the server cannot be reached', async () => {
    await sessionStore.signIn(env.signIn(NOA));
    const offline: Transport = async () => ({ status: 0, data: { code: 'NETWORK_ERROR', message: 'offline' } });
    apiClient.setTransport(offline);
    await signOut();
    expect(sessionStore.getState().status).toBe('signedOut');
  });

  it('waits at most 5 seconds for a server that does not answer', async () => {
    await sessionStore.signIn(env.signIn(NOA));
    jest.useFakeTimers();
    let aborted = false;
    const hanging: Transport = (request) =>
      new Promise((_resolve, reject) => {
        request.signal?.addEventListener('abort', () => {
          aborted = true;
          const error = new Error('Aborted');
          error.name = 'AbortError';
          reject(error);
        });
      });
    apiClient.setTransport(hanging);
    const done = signOut();
    await jest.advanceTimersByTimeAsync(4_999);
    expect(sessionStore.getState().status).toBe('signedIn');
    await jest.advanceTimersByTimeAsync(1);
    await done;
    expect(aborted).toBe(true);
    expect(sessionStore.getState().status).toBe('signedOut');
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
