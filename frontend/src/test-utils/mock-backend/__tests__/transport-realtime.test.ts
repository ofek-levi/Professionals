import { createWebSocketRealtimeClient, type RealtimeAuth } from '@/services/realtime/websocket-realtime-client';
import type { RealtimeEvent } from '@/services/realtime/types';

import { MAIN_CUSTOMER_IDS, PRO_IDS, SEED_IDS } from '../data/seed';
import { CLOSE_GOING_AWAY, CLOSE_UNAUTHORIZED } from '../socket-server';
import { createTestEnvironment, minutesFromNow, type TestEnvironment } from '../testing/test-server';

const NOA = MAIN_CUSTOMER_IDS.noa;
const DANIEL = MAIN_CUSTOMER_IDS.daniel;
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const settle = async () => {
  for (let i = 0; i < 5; i += 1) await flush();
};

describe('test transport', () => {
  it('forwards requests to the server and records them', async () => {
    const env = createTestEnvironment();
    expect(await env.transport({ method: 'GET', path: '/catalog/categories', headers: {} })).toMatchObject({ status: 200 });
    expect(await env.transport({ method: 'GET', path: '/nope', headers: {} })).toMatchObject({ status: 404, data: { code: 'NOT_FOUND' } });
    const withQuery = await env.transport({
      method: 'GET',
      path: '/professional/requests/nearby',
      query: { categoryIds: ['plumbing'], sort: 'nearest', excludeWithMyOffer: true },
      headers: { Authorization: `Bearer ${env.accessTokenFor(PRO_IDS.avi)}` },
    });
    expect(withQuery.status).toBe(200);
    // Invalid input is a 400 VALIDATION_ERROR, like the backend.
    expect(
      await env.transport({
        method: 'GET',
        path: '/professional/requests/nearby?sort=random',
        headers: { authorization: `Bearer ${env.accessTokenFor(PRO_IDS.avi)}` },
      }),
    ).toMatchObject({ status: 400, data: { code: 'VALIDATION_ERROR', fieldErrors: { sort: ['validation:invalid'] } } });
    expect(env.log.requests.map((request) => [request.method, request.path, request.status])).toEqual([
      ['GET', '/catalog/categories', 200],
      ['GET', '/nope', 404],
      ['GET', '/professional/requests/nearby', 200],
      ['GET', '/professional/requests/nearby', 400],
    ]);
  });

  it('copies JSON bodies, passes FormData through and honours an aborted signal', async () => {
    const env = createTestEnvironment();
    const body = { email: 'noa.levi@example.com', password: 'wrong' };
    await env.transport({ method: 'POST', path: '/auth/login', body, headers: {} });
    expect(body).toEqual({ email: 'noa.levi@example.com', password: 'wrong' });
    expect(env.log.requests[0].body).not.toBe(body);

    const form = new FormData();
    form.append('file', { uri: 'file:///leak.jpg', name: 'leak.jpg', type: 'image/jpeg' } as unknown as Blob);
    const upload = await env.transport({
      method: 'POST',
      path: '/uploads/images',
      body: form,
      headers: { Authorization: `Bearer ${env.accessTokenFor(NOA)}` },
    });
    expect(upload.status).toBe(201);
    expect(env.log.to('/uploads/images')[0].body).toBe(form);

    const aborted = new AbortController();
    aborted.abort();
    await expect(env.transport({ method: 'GET', path: '/catalog/categories', headers: {}, signal: aborted.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
});

describe('realtime endpoint with the app’s WebSocket client', () => {
  /** The app's realtime client, connected to the double as `userId` (auth from the harness). */
  function connect(env: TestEnvironment, userId: string, auth: Partial<RealtimeAuth> = {}) {
    const received: RealtimeEvent[] = [];
    const reconnects = jest.fn();
    const client = createWebSocketRealtimeClient({
      url: 'ws://localhost:4000/v1/realtime',
      openSocket: env.sockets.openSocket,
      appState: () => () => undefined,
      random: () => 0,
      backoff: { baseDelayMs: 1, maxDelayMs: 4 },
      auth: {
        getAccessToken: async () => env.accessTokenFor(userId),
        handleUnauthorized: async () => env.accessTokenFor(userId),
        ...auth,
      },
    });
    client.subscribe((event) => received.push(event));
    client.onReconnect(reconnects);
    client.connect();
    return { client, received, reconnects };
  }

  it('delivers the connected user’s events only, as JSON frames, after commit', async () => {
    const env = createTestEnvironment();
    const { client, received } = connect(env, NOA);
    await settle();
    expect(env.sockets.open()).toHaveLength(1);
    expect(env.sockets.open()[0].userId).toBe(NOA);

    await env.as(PRO_IDS.avi).offers.updateOffer(SEED_IDS.offers.leakAvi, { price: 610 });
    await settle();
    expect(received.map((event) => event.type).sort()).toEqual(['notification.created', 'offer.updated', 'request.updated']);

    // Daniel's conversation: nothing for Noa.
    received.length = 0;
    await env.as(PRO_IDS.lior).conversations.sendMessage(SEED_IDS.conversations.danielWifi, { text: 'Done!', clientMessageId: 'x' });
    await settle();
    expect(received).toEqual([]);

    client.disconnect();
    await settle();
    expect(env.sockets.open()).toHaveLength(0);
  });

  it('emits nothing for a failed (rolled back) operation', async () => {
    const env = createTestEnvironment();
    const events: RealtimeEvent[] = [];
    env.server.events.subscribe('user_tamar_shalev', (event) => events.push(event));
    const failed = env.as(PRO_IDS.avi).offers.createOffer('req_tamar_sink', {
      price: 400,
      currency: 'ILS',
      proposedStartAt: minutesFromNow(env, 5),
      estimatedDurationMinutes: null,
      message: null,
    });
    await expect(failed).rejects.toMatchObject({ status: 400 });
    expect(events).toHaveLength(0);
  });

  it('closes with 4001 for a bad token, then reconnects with a refreshed one', async () => {
    const env = createTestEnvironment();
    // Like the app's token manager: after the refresh, the current token is the new one.
    let current = 'access.forged.0.token';
    const handleUnauthorized = jest.fn(async () => {
      current = env.accessTokenFor(DANIEL);
      return current;
    });
    connect(env, DANIEL, { getAccessToken: async () => current, handleUnauthorized });
    await settle();
    expect(handleUnauthorized).toHaveBeenCalledWith('access.forged.0.token');
    const [rejected, accepted] = env.sockets.sockets;
    expect(rejected).toMatchObject({ userId: null, closed: true });
    expect(accepted).toMatchObject({ userId: DANIEL, closed: false });
  });

  it('closes the socket of a signed-out session with 4001 and stops when the refresh fails', async () => {
    const env = createTestEnvironment();
    const session = env.signIn(NOA);
    const handleUnauthorized = jest.fn(async () => null);
    connect(env, NOA, { getAccessToken: async () => session.accessToken, handleUnauthorized });
    await settle();
    expect(env.sockets.open()).toHaveLength(1);

    await env.as(null).auth.logout({ refreshToken: session.refreshToken });
    await settle();
    expect(handleUnauthorized).toHaveBeenCalledTimes(1);
    expect(env.sockets.open()).toHaveLength(0);
    expect(env.sockets.sockets).toHaveLength(1); // no reconnect after the session ended
    expect(CLOSE_UNAUTHORIZED).toBe(4001);
  });

  it('closes a socket whose token expired with 4001 on its next event', async () => {
    const env = createTestEnvironment();
    const tokens: string[] = [];
    connect(env, NOA, {
      getAccessToken: async () => {
        tokens.push(env.accessTokenFor(NOA));
        return tokens[tokens.length - 1];
      },
      handleUnauthorized: async () => env.accessTokenFor(NOA),
    });
    await settle();
    env.clock.advanceMinutes(31);
    await env.as(PRO_IDS.avi).offers.updateOffer(SEED_IDS.offers.leakAvi, { price: 620 });
    await settle();
    const [expired, fresh] = env.sockets.sockets;
    expect(expired.closed).toBe(true);
    expect(fresh).toMatchObject({ userId: NOA, closed: false });
    expect(fresh.token).not.toBe(expired.token);
  });

  it('reconnects after a server restart (1001) and tells listeners to refetch', async () => {
    const env = createTestEnvironment();
    const { received, reconnects } = connect(env, NOA);
    await settle();
    env.sockets.dropAll(CLOSE_GOING_AWAY);
    await new Promise((resolve) => setTimeout(resolve, 20));
    await settle();
    expect(env.sockets.open()).toHaveLength(1);
    expect(reconnects).toHaveBeenCalledTimes(1);

    await env.as(PRO_IDS.avi).offers.updateOffer(SEED_IDS.offers.leakAvi, { price: 630 });
    await settle();
    expect(received.some((event) => event.type === 'offer.updated')).toBe(true);
  });
});
