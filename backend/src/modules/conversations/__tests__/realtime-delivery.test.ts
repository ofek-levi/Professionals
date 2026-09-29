/**
 * End to end over real sockets: API instances (HTTP + `/v1/realtime` on one server) publishing
 * through Redis pub/sub, `ws` clients receiving the app's `RealtimeEvent` frames.
 */
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { clearDatabase, createTestDeps } from '../../../../test/app.js';
import { accessTokenFor, signInCustomer } from '../../../../test/auth.js';
import { testRedis } from '../../../../test/context.js';
import { connectSocket, type TestSocket } from '../../../../test/realtime.js';
import { createApp } from '../../../app.js';
import type { AppDeps } from '../../../deps.js';
import { KEY_SPACES } from '../../../infra/keys.js';
import { CLOSE_UNAUTHORIZED, RedisRealtimePublisher, attachRealtimeServer } from '../../../infra/realtime/index.js';
import { signAccessToken } from '../../../lib/access-token.js';
import { createChat } from './chat-fixture.js';

const deps = createTestDeps({ now: '2026-10-01T09:00:00.000Z' });
const channel = deps.keys.key(KEY_SPACES.realtimeChannel);
/** The app's real publisher: events leave through Redis, whichever instance handles the request. */
const apiDeps: AppDeps = { ...deps, realtime: new RedisRealtimePublisher(deps.redis, channel, deps.logger) };

interface ApiInstance {
  http: string;
  ws: string;
  close(): Promise<void>;
}

const instances: ApiInstance[] = [];
const sockets: TestSocket[] = [];

async function startInstance(): Promise<ApiInstance> {
  const server = createServer(createApp(apiDeps));
  const subscriber = testRedis().duplicate();
  const realtime = await attachRealtimeServer({ httpServer: server, subscriber, channel, tokens: deps.env.jwt, clock: deps.clock, logger: deps.logger });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  const instance = {
    http: `http://127.0.0.1:${port}`,
    ws: `ws://127.0.0.1:${port}/v1/realtime`,
    async close() {
      await realtime.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      subscriber.disconnect();
    },
  };
  instances.push(instance);
  return instance;
}

async function connect(instance: ApiInstance, token: string): Promise<TestSocket> {
  const socket = connectSocket(instance.ws, token);
  sockets.push(socket);
  await socket.opened;
  return socket;
}

const quietPeriod = () => new Promise((resolve) => setTimeout(resolve, 150));

beforeEach(async () => {
  await clearDatabase();
  deps.clock.set('2026-10-01T09:00:00.000Z');
});

afterAll(async () => {
  sockets.forEach((socket) => socket.socket.terminate());
  await Promise.all(instances.map((instance) => instance.close()));
});

describe('messaging over the realtime WebSocket', () => {
  it('delivers a sent message to both participants and nobody else', async () => {
    const api = await startInstance();
    const chat = await createChat(deps);
    const outsider = await signInCustomer(deps);
    const [customerSocket, proSocket, outsiderSocket] = await Promise.all([
      connect(api, chat.customer.token),
      connect(api, chat.pro.token),
      connect(api, outsider.token),
    ]);

    const sent = await request(api.http)
      .post(`${chat.path}/messages`)
      .set(chat.pro.headers)
      .send({ text: 'On my way', clientMessageId: 'ws-1' })
      .expect(201);

    expect(await customerSocket.nextEvent()).toMatchObject({
      type: 'notification.created',
      notification: { userId: chat.customer.user._id.toHexString(), type: 'new_message', params: { messagePreview: 'On my way' } },
    });
    expect(await customerSocket.nextEvent()).toEqual({ type: 'message.created', message: sent.body });
    expect(await proSocket.nextEvent()).toEqual({ type: 'message.created', message: sent.body });
    await quietPeriod();
    expect(proSocket.events).toHaveLength(1);
    expect(outsiderSocket.events).toEqual([]);
  });

  it('fans out across API instances (message on one, receipt back on the other)', async () => {
    const [first, second] = await Promise.all([startInstance(), startInstance()]);
    const chat = await createChat(deps);
    const proSocket = await connect(first, chat.pro.token);
    const customerSocket = await connect(second, chat.customer.token);

    await request(first.http).post(`${chat.path}/messages`).set(chat.pro.headers).send({ text: 'Hello', clientMessageId: 'x-1' }).expect(201);
    expect((await customerSocket.nextEvent()).type).toBe('notification.created');
    expect(await customerSocket.nextEvent()).toMatchObject({ type: 'message.created', message: { text: 'Hello' } });
    expect(await proSocket.nextEvent()).toMatchObject({ type: 'message.created' });

    deps.clock.advanceMinutes(1);
    await request(second.http).post(`${chat.path}/read`).set(chat.customer.headers).expect(200);
    const receipt = {
      type: 'conversation.read',
      conversationId: chat.conversationId,
      readerId: chat.customer.user._id.toHexString(),
      readAt: '2026-10-01T09:01:00.000Z',
    };
    expect(await proSocket.nextEvent()).toEqual(receipt);
    expect(await customerSocket.nextEvent()).toEqual(receipt);
  });

  it('closes with 4001 for a bad token and when the access token expires', async () => {
    const api = await startInstance();
    expect((await connectSocket(api.ws, 'not-a-jwt').closed).code).toBe(CLOSE_UNAUTHORIZED);

    const customer = await signInCustomer(deps);
    const { token, expiresAt } = signAccessToken(
      deps.env.jwt,
      { userId: customer.user._id.toHexString(), role: 'customer', sessionId: 's' },
      deps.clock,
    );
    // 300 ms before expiry: the socket opens, then the expiry timer closes it.
    deps.clock.set(new Date(expiresAt.getTime() - 300));
    const socket = await connect(api, token);
    expect(await socket.closed).toEqual({ code: CLOSE_UNAUTHORIZED, reason: 'Token expired' });

    // An expired token is refused right away.
    deps.clock.set(new Date(expiresAt.getTime() + 1000));
    expect((await connectSocket(api.ws, token).closed).code).toBe(CLOSE_UNAUTHORIZED);
    // A fresh token (what the app gets from /auth/refresh) connects again.
    await expect(connect(api, accessTokenFor(deps, customer.user))).resolves.toBeDefined();
  });
});
