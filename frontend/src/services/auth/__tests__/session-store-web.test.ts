/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * The session store on the web: `localStorage` (never SecureStore), and other tabs follow along
 * through the `storage` event: a sign-out elsewhere signs this tab out, refreshed tokens are
 * adopted (the token manager reloads them before spending its own refresh token).
 */
import type { AuthSession, SessionTokens } from '@/types/api';

import type { SessionStore } from '../session-store';

const KEY = 'professionals.session.v2';

const session: AuthSession = {
  accessToken: 'access-1',
  accessTokenExpiresAt: '2026-09-30T10:30:00.000Z',
  refreshToken: 'refresh-1',
  user: {
    id: 'user_avi_mizrahi',
    role: 'professional',
    firstName: 'Avi',
    lastName: 'Mizrahi',
    displayName: 'AquaFix Plumbing',
    email: 'avi@aquafix.example.com',
    phone: '050-000-0000',
    avatarUrl: null,
    preferredLanguage: 'he',
    createdAt: '2025-01-01T00:00:00.000Z',
  },
};

const otherTabTokens: SessionTokens = { accessToken: 'access-9', accessTokenExpiresAt: '2026-09-30T11:00:00.000Z', refreshToken: 'refresh-9' };

/** `window.localStorage` and the `storage` event of a browser tab. */
function installBrowser() {
  const items = new Map<string, string>();
  const storage = {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
  const listeners: ((event: { key: string | null }) => void)[] = [];
  const target = window as unknown as Record<string, unknown>;
  const previous = { localStorage: target.localStorage, addEventListener: target.addEventListener };
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
  target.addEventListener = (type: string, listener: (event: { key: string | null }) => void) => {
    if (type === 'storage') listeners.push(listener);
  };
  return {
    items,
    /** Another tab wrote `value` (or removed the entry with `null`). */
    otherTab(value: string | null) {
      if (value === null) items.delete(KEY);
      else items.set(KEY, value);
      listeners.forEach((listener) => listener({ key: KEY }));
    },
    restore() {
      Object.defineProperty(window, 'localStorage', { value: previous.localStorage, configurable: true });
      target.addEventListener = previous.addEventListener;
    },
  };
}

/** The store as loaded in a browser tab (`Platform.OS === 'web'` when the module is evaluated). */
function launchWebTab(): { store: SessionStore; secureStore: { setItemAsync: jest.Mock } } {
  let store: SessionStore | undefined;
  const secureStore = { setItemAsync: jest.fn(), getItemAsync: jest.fn(), deleteItemAsync: jest.fn() };
  jest.isolateModules(() => {
    jest.doMock('expo-secure-store', () => secureStore);
    const { Platform } = require('react-native') as typeof import('react-native');
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    store = (require('../session-store') as typeof import('../session-store')).sessionStore;
  });
  return { store: store!, secureStore };
}

let browser: ReturnType<typeof installBrowser>;
beforeEach(() => {
  browser = installBrowser();
});
afterEach(() => {
  browser.restore();
});

describe('session store (web)', () => {
  it('keeps the session in localStorage and never touches SecureStore', async () => {
    const { store, secureStore } = launchWebTab();
    await store.hydrate();
    await store.signIn(session);
    expect(JSON.parse(browser.items.get(KEY)!)).toEqual({
      accessToken: 'access-1',
      accessTokenExpiresAt: session.accessTokenExpiresAt,
      refreshToken: 'refresh-1',
      userId: 'user_avi_mizrahi',
      role: 'professional',
    });
    expect(secureStore.setItemAsync).not.toHaveBeenCalled();

    const reloaded = launchWebTab().store;
    await expect(reloaded.hydrate()).resolves.toEqual({ status: 'signedIn', userId: 'user_avi_mizrahi', role: 'professional' });
  });

  it('follows a sign-out in another tab', async () => {
    const { store } = launchWebTab();
    await store.hydrate();
    await store.signIn(session);
    const listener = jest.fn();
    store.subscribe(listener);
    browser.otherTab(null);
    expect(listener).toHaveBeenCalledWith({ status: 'signedOut', userId: null, role: null });
    expect(store.getTokens()).toBeNull();
  });

  it('adopts tokens another tab refreshed, without an identity change', async () => {
    const { store } = launchWebTab();
    await store.hydrate();
    await store.signIn(session);
    const listener = jest.fn();
    store.subscribe(listener);
    browser.otherTab(JSON.stringify({ ...otherTabTokens, userId: 'user_avi_mizrahi', role: 'professional' }));
    expect(store.getTokens()).toEqual(otherTabTokens);
    expect(listener).not.toHaveBeenCalled();
  });

  it('reloadTokens() picks up tokens another tab wrote before its event arrived', async () => {
    const { store } = launchWebTab();
    await store.hydrate();
    await store.signIn(session);
    browser.items.set(KEY, JSON.stringify({ ...otherTabTokens, userId: 'user_avi_mizrahi', role: 'professional' }));
    await expect(store.reloadTokens()).resolves.toEqual(otherTabTokens);
    // Another account's tokens are never adopted into this session.
    browser.items.set(KEY, JSON.stringify({ ...otherTabTokens, accessToken: 'x', userId: 'user_noa_levi', role: 'customer' }));
    await expect(store.reloadTokens()).resolves.toEqual(otherTabTokens);
  });

  it('switches identity when another tab signs in as someone else', async () => {
    const { store } = launchWebTab();
    await store.hydrate();
    await store.signIn(session);
    const listener = jest.fn();
    store.subscribe(listener);
    browser.otherTab(JSON.stringify({ ...otherTabTokens, userId: 'user_noa_levi', role: 'customer' }));
    expect(listener).toHaveBeenCalledWith({ status: 'signedIn', userId: 'user_noa_levi', role: 'customer' });
  });
});
