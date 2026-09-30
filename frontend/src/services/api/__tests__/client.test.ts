/**
 * The API client with the app's token manager against the backend test double: bearer tokens,
 * anonymous auth endpoints, one shared refresh for concurrent 401s (then one retry each), and
 * signing out when the refresh token is rejected.
 */
import { createTokenManager } from '@/services/auth/token-manager';
import { MAIN_CUSTOMER_IDS } from '@/test-utils/mock-backend/data/seed';
import { createTestEnvironment, expectApiError, type TestEnvironment } from '@/test-utils/mock-backend/testing/test-server';
import type { SessionTokens } from '@/types/api';

import { ApiClient } from '../client';
import { ApiError } from '../errors';
import { createMarketplaceApi } from '../marketplace-api';
import type { Transport } from '../transport';

const NOA = MAIN_CUSTOMER_IDS.noa;

/** The app's wiring (services/api/index.ts) with an in-memory session store. */
function createApp(env: TestEnvironment, initial: SessionTokens) {
  const store = {
    tokens: initial as SessionTokens | null,
    getTokens: () => store.tokens,
    reloadTokens: async () => store.tokens,
    updateTokens: jest.fn(async (next: SessionTokens) => {
      store.tokens = next;
    }),
    signOut: jest.fn(async () => {
      store.tokens = null;
    }),
  };
  const tokens = createTokenManager({
    store,
    refresh: (refreshToken) => api.auth.refresh({ refreshToken }),
    now: () => env.clock.now().getTime(),
  });
  const api = createMarketplaceApi(new ApiClient({ transport: env.transport, auth: tokens, getLanguage: () => 'he' }));
  return { api, store };
}

describe('ApiClient with the token manager', () => {
  let env: TestEnvironment;
  beforeEach(() => {
    env = createTestEnvironment();
  });

  it('sends the bearer token and the language, and never a token to the public auth endpoints', async () => {
    const session = env.signIn(NOA);
    const { api } = createApp(env, session);
    await api.users.getCurrentUser();
    await api.auth.requestPasswordReset({ email: 'noa.levi@example.com' });
    const [me, reset] = env.log.requests;
    expect(me.headers).toMatchObject({ Authorization: `Bearer ${session.accessToken}`, 'Accept-Language': 'he' });
    expect(reset.headers.Authorization).toBeUndefined();
  });

  it('refreshes before a request once the access token is about to expire', async () => {
    const session = env.signIn(NOA);
    const { api, store } = createApp(env, session);
    env.clock.advanceMinutes(29.5); // within the 60 s leeway
    await api.users.getCurrentUser();
    expect(env.log.requests.map((request) => [request.path, request.status])).toEqual([
      ['/auth/refresh', 200],
      ['/me', 200],
    ]);
    expect(store.tokens?.refreshToken).not.toBe(session.refreshToken);
    expect(env.log.requests[1].headers.Authorization).toBe(`Bearer ${store.tokens?.accessToken}`);
  });

  it('answers six concurrent 401s with one refresh and retries each request once', async () => {
    const session = env.signIn(NOA);
    const { api, store } = createApp(env, { ...session, accessToken: 'access.revoked.0.token' });
    const results = await Promise.all([
      api.users.getCurrentUser(),
      api.dashboard.getCustomerDashboard(),
      api.notifications.getUnreadCount(),
      api.conversations.getUnreadMessagesCount(),
      api.requests.getCustomerRequests(),
      api.customers.getCustomerProfile(),
    ]);
    expect(results).toHaveLength(6);
    expect(env.log.to('/auth/refresh')).toHaveLength(1);
    const rejected = env.log.requests.filter((request) => request.status === 401);
    const retried = env.log.requests.filter((request) => request.path !== '/auth/refresh' && request.status === 200);
    expect(rejected).toHaveLength(6);
    expect(retried).toHaveLength(6);
    expect(new Set(retried.map((request) => request.headers.Authorization))).toEqual(new Set([`Bearer ${store.tokens?.accessToken}`]));
    expect(store.signOut).not.toHaveBeenCalled();
  });

  it('signs out and surfaces the 401 when the refresh token is rejected', async () => {
    const session = env.signIn(NOA);
    await env.as(null).auth.logout({ refreshToken: session.refreshToken }); // ended on another device
    env.log.clear();
    const { api, store } = createApp(env, session);
    const error = await expectApiError(api.users.getCurrentUser());
    expect(error).toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
    expect(store.signOut).toHaveBeenCalledTimes(1);
    expect(env.log.requests.map((request) => [request.path, request.status])).toEqual([
      ['/me', 401],
      ['/auth/refresh', 401],
    ]);
  });

  it('never refreshes for a 401 from an anonymous endpoint', async () => {
    const session = env.signIn(NOA);
    const { api, store } = createApp(env, session);
    expect(await expectApiError(api.auth.login({ email: 'noa.levi@example.com', password: 'wrong-password' }))).toMatchObject({
      status: 401,
      code: 'INVALID_CREDENTIALS',
    });
    expect(env.log.to('/auth/refresh')).toHaveLength(0);
    expect(store.signOut).not.toHaveBeenCalled();
  });
});

describe('ApiClient errors', () => {
  const answer = (status: number, data: unknown, headers?: Record<string, string>): Transport => async () => ({ status, data, headers });

  it('maps a 429 with Retry-After', async () => {
    const client = new ApiClient({ transport: answer(429, { code: 'RATE_LIMITED', message: 'Slow down' }, { 'retry-after': '42' }) });
    const error = await expectApiError(client.get('/requests'));
    expect(error).toMatchObject({ status: 429, code: 'RATE_LIMITED', retryAfterSeconds: 42 });
  });

  it('reads field errors of a 400 VALIDATION_ERROR', async () => {
    const client = new ApiClient({
      transport: answer(400, {
        code: 'VALIDATION_ERROR',
        message: 'The request payload is invalid',
        fieldErrors: { 'location.addressLine': ['validation:location.addressRequired'] },
      }),
    });
    const error = await expectApiError(client.post('/requests', {}));
    expect(error).toBeInstanceOf(ApiError);
    expect(error.fieldErrors).toEqual({ 'location.addressLine': ['validation:location.addressRequired'] });
  });

  it('does not retry when the refresh hands back the rejected token', async () => {
    const transport = jest.fn(answer(401, { code: 'UNAUTHORIZED', message: 'Expired' }));
    const client = new ApiClient({ transport, auth: { getAccessToken: () => 'same', handleUnauthorized: async () => 'same' } });
    await expectApiError(client.get('/me'));
    expect(transport).toHaveBeenCalledTimes(1);
  });
});
