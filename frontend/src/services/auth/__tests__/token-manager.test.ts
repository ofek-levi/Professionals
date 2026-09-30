/**
 * The session's token manager: proactive refresh before expiry, reactive single-flight refresh
 * after a 401, the server's replay answer, other tabs, and signing out when the refresh token is
 * rejected (never on a network error).
 */
import { ApiError } from '@/services/api/errors';
import type { SessionTokens } from '@/types/api';

import { createTokenManager, REFRESH_LEEWAY_MS } from '../token-manager';

const NOW = Date.parse('2026-09-30T10:00:00.000Z');
const inMinutes = (minutes: number) => new Date(NOW + minutes * 60_000).toISOString();

function tokens(n: number, expiresInMinutes = 30): SessionTokens {
  return { accessToken: `access-${n}`, accessTokenExpiresAt: inMinutes(expiresInMinutes), refreshToken: `refresh-${n}` };
}

interface FakeStore {
  tokens: SessionTokens | null;
  persisted: SessionTokens | null;
  signedOut: boolean;
  getTokens(): SessionTokens | null;
  reloadTokens: jest.Mock<Promise<SessionTokens | null>, []>;
  updateTokens: jest.Mock<Promise<void>, [SessionTokens]>;
  signOut: jest.Mock<Promise<void>, []>;
}

/** The session store's token API, in memory. `persisted` is what another tab may have written. */
function createStore(initial: SessionTokens | null): FakeStore {
  const store: FakeStore = {
    tokens: initial,
    persisted: initial,
    signedOut: false,
    getTokens: () => store.tokens,
    reloadTokens: jest.fn(async () => {
      if (store.persisted && store.tokens) store.tokens = store.persisted;
      return store.tokens;
    }),
    updateTokens: jest.fn(async (next: SessionTokens) => {
      store.tokens = next;
      store.persisted = next;
    }),
    signOut: jest.fn(async () => {
      store.tokens = null;
      store.persisted = null;
      store.signedOut = true;
    }),
  };
  return store;
}

/** A refresh endpoint whose answers the test resolves one by one. */
function deferredRefresh() {
  const calls: { refreshToken: string; resolve: (tokens: SessionTokens) => void; reject: (error: unknown) => void }[] = [];
  const refresh = jest.fn(
    (refreshToken: string) =>
      new Promise<SessionTokens>((resolve, reject) => {
        calls.push({ refreshToken, resolve, reject });
      }),
  );
  return { refresh, calls };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));
const unauthorized = () => new ApiError(401, { code: 'UNAUTHORIZED', message: 'The session has expired' });

describe('proactive refresh', () => {
  it('hands out the current token while it is valid for longer than the leeway', async () => {
    const store = createStore(tokens(1));
    const refresh = jest.fn();
    const manager = createTokenManager({ store, refresh, now: () => NOW });
    await expect(manager.getAccessToken()).resolves.toBe('access-1');
    expect(refresh).not.toHaveBeenCalled();
    expect(REFRESH_LEEWAY_MS).toBe(60_000);
  });

  it('refreshes once, before handing out a token that expires within the leeway', async () => {
    const store = createStore(tokens(1, 0.5));
    const { refresh, calls } = deferredRefresh();
    const manager = createTokenManager({ store, refresh, now: () => NOW });

    const requests = [manager.getAccessToken(), manager.getAccessToken(), manager.getAccessToken()];
    await flush();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(calls[0].refreshToken).toBe('refresh-1');
    calls[0].resolve(tokens(2));
    await expect(Promise.all(requests)).resolves.toEqual(['access-2', 'access-2', 'access-2']);
    // The rotated pair is stored before it is used.
    expect(store.updateTokens).toHaveBeenCalledWith(tokens(2));
    await expect(manager.getAccessToken()).resolves.toBe('access-2');
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('treats an unreadable expiry as expired', async () => {
    const store = createStore({ ...tokens(1), accessTokenExpiresAt: 'soon' });
    const manager = createTokenManager({ store, refresh: async () => tokens(2), now: () => NOW });
    await expect(manager.getAccessToken()).resolves.toBe('access-2');
  });

  it('keeps the session and tries the current token when the refresh cannot reach the server', async () => {
    const store = createStore(tokens(1, 0.5));
    const offline = new ApiError(0, { code: 'NETWORK_ERROR', message: 'offline' });
    const manager = createTokenManager({ store, refresh: async () => Promise.reject(offline), now: () => NOW });
    await expect(manager.getAccessToken()).resolves.toBe('access-1');
    expect(store.signOut).not.toHaveBeenCalled();
  });

  it('is signed out without tokens', async () => {
    const manager = createTokenManager({ store: createStore(null), refresh: jest.fn(), now: () => NOW });
    await expect(manager.getAccessToken()).resolves.toBeNull();
    await expect(manager.handleUnauthorized('access-1')).resolves.toBeNull();
  });
});

describe('reactive refresh (after a 401)', () => {
  it('shares one refresh between every request rejected with the same token', async () => {
    const store = createStore(tokens(1));
    const { refresh, calls } = deferredRefresh();
    const manager = createTokenManager({ store, refresh, now: () => NOW });

    const retries = Array.from({ length: 6 }, () => manager.handleUnauthorized('access-1'));
    await flush();
    expect(refresh).toHaveBeenCalledTimes(1);
    calls[0].resolve(tokens(2));
    await expect(Promise.all(retries)).resolves.toEqual(Array(6).fill('access-2'));

    // A late 401 for the old token (sent before the refresh) retries with the new one, no refresh.
    await expect(manager.handleUnauthorized('access-1')).resolves.toBe('access-2');
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('refreshes again when the new token is rejected too', async () => {
    const store = createStore(tokens(1));
    let n = 1;
    const refresh = jest.fn(async () => tokens(++n));
    const manager = createTokenManager({ store, refresh, now: () => NOW });
    await expect(manager.handleUnauthorized('access-1')).resolves.toBe('access-2');
    await expect(manager.handleUnauthorized('access-2')).resolves.toBe('access-3');
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('stores the server’s replay answer (the same new refresh token) like any other', async () => {
    const store = createStore(tokens(1));
    const replayed = { ...tokens(2), accessToken: 'access-2b' };
    const refresh = jest.fn().mockResolvedValueOnce(tokens(2)).mockResolvedValueOnce(replayed);
    const manager = createTokenManager({ store, refresh, now: () => NOW });
    await manager.handleUnauthorized('access-1');
    await expect(manager.handleUnauthorized('access-2')).resolves.toBe('access-2b');
    expect(store.tokens).toEqual(replayed);
  });

  it('signs out (once) when the refresh token is rejected, and every waiting request gets null', async () => {
    const store = createStore(tokens(1));
    const { refresh, calls } = deferredRefresh();
    const manager = createTokenManager({ store, refresh, now: () => NOW });
    const retries = [manager.handleUnauthorized('access-1'), manager.handleUnauthorized('access-1'), manager.getAccessToken()];
    await flush();
    calls[0].reject(unauthorized());
    await expect(Promise.all(retries)).resolves.toEqual([null, null, null]);
    expect(store.signOut).toHaveBeenCalledTimes(1);
    expect(store.signedOut).toBe(true);
  });

  it('also signs out on 400 (malformed refresh token)', async () => {
    const store = createStore(tokens(1));
    const invalid = new ApiError(400, { code: 'VALIDATION_ERROR', message: 'invalid' });
    const manager = createTokenManager({ store, refresh: async () => Promise.reject(invalid), now: () => NOW });
    await expect(manager.handleUnauthorized('access-1')).resolves.toBeNull();
    expect(store.signOut).toHaveBeenCalled();
  });

  it('rethrows a network failure without signing out', async () => {
    const store = createStore(tokens(1));
    const offline = new ApiError(0, { code: 'NETWORK_ERROR', message: 'offline' });
    const manager = createTokenManager({ store, refresh: async () => Promise.reject(offline), now: () => NOW });
    await expect(manager.handleUnauthorized('access-1')).rejects.toBe(offline);
    expect(store.signOut).not.toHaveBeenCalled();
    expect(store.tokens).toEqual(tokens(1));
  });
});

describe('concurrent changes', () => {
  it('uses the tokens another tab stored instead of spending the old refresh token', async () => {
    const store = createStore(tokens(1, 0.5));
    store.persisted = tokens(7);
    const refresh = jest.fn();
    const manager = createTokenManager({ store, refresh, now: () => NOW });
    await expect(manager.getAccessToken()).resolves.toBe('access-7');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('drops a refresh answer when the session changed meanwhile (signed out or another account)', async () => {
    const store = createStore(tokens(1));
    const { refresh, calls } = deferredRefresh();
    const manager = createTokenManager({ store, refresh, now: () => NOW });
    const retry = manager.handleUnauthorized('access-1');
    await flush();
    store.tokens = null; // signed out while the refresh was in flight
    calls[0].resolve(tokens(2));
    await expect(retry).resolves.toBeNull();
    expect(store.updateTokens).not.toHaveBeenCalled();
  });

  it('does not sign out a newer session when the old session’s refresh is rejected', async () => {
    const store = createStore(tokens(1));
    const { refresh, calls } = deferredRefresh();
    const manager = createTokenManager({ store, refresh, now: () => NOW });
    const retry = manager.handleUnauthorized('access-1');
    await flush();
    store.tokens = tokens(9); // someone signed in again meanwhile
    calls[0].reject(unauthorized());
    await expect(retry).resolves.toBe('access-9');
    expect(store.signOut).not.toHaveBeenCalled();
  });
});
