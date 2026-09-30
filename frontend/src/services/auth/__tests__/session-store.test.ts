/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * The session store on iOS/Android: the session lives in expo-secure-store (Keychain / Keystore,
 * this device only), survives a relaunch, and React only sees the identity (token refreshes never
 * notify it). `jest.isolateModules` simulates a relaunch; the SecureStore double keeps its items.
 */
import { __secureStore, AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY } from '@/test-utils/native/expo-secure-store.mock';
import type { AuthSession, SessionTokens } from '@/types/api';

import type { SessionStore } from '../session-store';

const KEY = 'professionals.session.v2';

const session: AuthSession = {
  accessToken: 'access-1',
  accessTokenExpiresAt: '2026-09-30T10:30:00.000Z',
  refreshToken: 'refresh-1',
  user: {
    id: 'user_noa_levi',
    role: 'customer',
    firstName: 'Noa',
    lastName: 'Levi',
    displayName: 'Noa Levi',
    email: 'noa.levi@example.com',
    phone: '052-555-1234',
    avatarUrl: null,
    preferredLanguage: 'en',
    createdAt: '2025-01-01T00:00:00.000Z',
  },
};

const refreshed: SessionTokens = { accessToken: 'access-2', accessTokenExpiresAt: '2026-09-30T11:00:00.000Z', refreshToken: 'refresh-2' };

/** A fresh copy of the module, as after an app launch. */
function launch(): SessionStore {
  let store: SessionStore | undefined;
  jest.isolateModules(() => {
    store = (require('../session-store') as typeof import('../session-store')).sessionStore;
  });
  return store!;
}

beforeEach(() => {
  __secureStore.reset();
});

describe('session store (iOS/Android)', () => {
  it('starts signed out and keeps the tokens in SecureStore, readable after the first unlock on this device only', async () => {
    const store = launch();
    await expect(store.hydrate()).resolves.toEqual({ status: 'signedOut', userId: null, role: null });

    await store.signIn(session);
    expect(store.getState()).toEqual({ status: 'signedIn', userId: 'user_noa_levi', role: 'customer' });
    expect(store.getTokens()).toEqual({ accessToken: 'access-1', accessTokenExpiresAt: session.accessTokenExpiresAt, refreshToken: 'refresh-1' });
    expect(store.getAccessToken()).toBe('access-1');
    expect(JSON.parse(__secureStore.items.get(KEY)!)).toEqual({
      accessToken: 'access-1',
      accessTokenExpiresAt: session.accessTokenExpiresAt,
      refreshToken: 'refresh-1',
      userId: 'user_noa_levi',
      role: 'customer',
    });
    expect(__secureStore.writes.at(-1)).toEqual({ key: KEY, options: { keychainAccessible: AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY } });
    // Nothing but identity + tokens is stored (no profile data).
    expect(__secureStore.items.get(KEY)).not.toContain('noa.levi@example.com');
  });

  it('stores the access-token expiry on the device clock (a clock running ahead never sees fresh tokens as expired)', async () => {
    const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, '');
    const iat = Math.floor(Date.now() / 1000) - 45 * 60; // the server is 45 minutes behind this device
    const jwt = `${encode({ alg: 'HS256' })}.${encode({ iat, exp: iat + 1800 })}.sig`;
    const store = launch();
    await store.hydrate();
    const before = Date.now();
    await store.signIn({ ...session, accessToken: jwt, accessTokenExpiresAt: new Date((iat + 1800) * 1000).toISOString() });
    const expiresAt = Date.parse(store.getTokens()!.accessTokenExpiresAt);
    expect(expiresAt).toBeGreaterThanOrEqual(before + 30 * 60_000);
    expect(expiresAt).toBeLessThanOrEqual(Date.now() + 30 * 60_000);
  });

  it('restores the session after a relaunch, hydrating once', async () => {
    await launch().signIn(session);
    const relaunched = launch();
    expect(relaunched.getState().status).toBe('loading');
    const [first, second] = await Promise.all([relaunched.hydrate(), relaunched.hydrate()]);
    expect(first).toBe(second);
    expect(relaunched.getState()).toEqual({ status: 'signedIn', userId: 'user_noa_levi', role: 'customer' });
    expect(relaunched.getTokens()?.refreshToken).toBe('refresh-1');
  });

  it('stores refreshed tokens without notifying identity listeners', async () => {
    const store = launch();
    await store.hydrate();
    await store.signIn(session);
    const listener = jest.fn();
    store.subscribe(listener);
    await store.updateTokens(refreshed);
    expect(listener).not.toHaveBeenCalled();
    expect(store.getTokens()).toEqual(refreshed);
    expect(JSON.parse(__secureStore.items.get(KEY)!)).toMatchObject(refreshed);
    // A relaunch uses the rotated refresh token, never the spent one.
    const relaunched = launch();
    await relaunched.hydrate();
    expect(relaunched.getTokens()).toEqual(refreshed);
    // On iOS/Android there is no other tab: reloading returns what is in memory.
    await expect(store.reloadTokens()).resolves.toEqual(refreshed);
  });

  it('ignores token updates while signed out', async () => {
    const store = launch();
    await store.hydrate();
    await store.updateTokens(refreshed);
    expect(store.getTokens()).toBeNull();
    expect(__secureStore.items.has(KEY)).toBe(false);
  });

  it('signs out: identity listeners are told, the tokens are deleted', async () => {
    const store = launch();
    await store.hydrate();
    await store.signIn(session);
    const listener = jest.fn();
    store.subscribe(listener);
    await store.signOut();
    expect(listener).toHaveBeenCalledWith({ status: 'signedOut', userId: null, role: null });
    expect(store.getTokens()).toBeNull();
    expect(store.getAccessToken()).toBeNull();
    expect(__secureStore.items.has(KEY)).toBe(false);
    const relaunched = launch();
    await expect(relaunched.hydrate()).resolves.toMatchObject({ status: 'signedOut' });
  });

  it('treats a corrupt or incomplete entry as signed out', async () => {
    for (const raw of ['{not json', JSON.stringify({ accessToken: 'a', userId: 'u', role: 'customer' }), JSON.stringify({ ...refreshed, userId: 'u', role: 'admin' })]) {
      __secureStore.items.set(KEY, raw);
      await expect(launch().hydrate()).resolves.toMatchObject({ status: 'signedOut' });
    }
  });

  it('keeps working in memory when the Keychain refuses a write', async () => {
    const SecureStore = jest.requireMock('expo-secure-store') as { setItemAsync: (key: string, value: string) => Promise<void> };
    const setItem = jest.spyOn(SecureStore, 'setItemAsync').mockRejectedValueOnce(new Error('Keychain locked'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      let store: SessionStore | undefined;
      jest.isolateModules(() => {
        jest.doMock('expo-secure-store', () => SecureStore);
        store = (require('../session-store') as typeof import('../session-store')).sessionStore;
      });
      await store!.hydrate();
      await store!.signIn(session);
      expect(store!.getState().status).toBe('signedIn');
      expect(warn).toHaveBeenCalledWith('[session] could not persist the session', expect.any(Error));
    } finally {
      setItem.mockRestore();
      warn.mockRestore();
    }
  });
});
