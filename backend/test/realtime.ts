/**
 * Real WebSocket server for tests: the test app on an ephemeral port with the realtime endpoint
 * attached (Redis pub/sub on this file's prefix), plus a small client helper.
 */
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { WebSocket } from 'ws';

import { createApp } from '../src/app.js';
import { KEY_SPACES } from '../src/infra/keys.js';
import { RedisRealtimePublisher, attachRealtimeServer } from '../src/infra/realtime/index.js';
import { isSessionDenied, sessionRevokedChannel } from '../src/infra/session-denylist.js';
import type { RealtimeEvent } from '../src/shared/contract/index.js';
import type { TestDeps } from './app.js';
import { testRedis } from './context.js';

export interface RealtimeTestServer {
  /** `ws://127.0.0.1:<port>/v1/realtime` */
  url: string;
  /** Publishes through Redis like any API instance would. */
  publisher: RedisRealtimePublisher;
  close(): Promise<void>;
}

export async function startRealtimeServer(deps: TestDeps, options: { heartbeatMs?: number } = {}): Promise<RealtimeTestServer> {
  const server = createServer(createApp(deps));
  const subscriber = testRedis().duplicate();
  const channel = deps.keys.key(KEY_SPACES.realtimeChannel);
  const realtime = await attachRealtimeServer({
    httpServer: server,
    subscriber,
    channel,
    tokens: deps.env.jwt,
    clock: deps.clock,
    logger: deps.logger,
    isSessionRevoked: (sessionId) => isSessionDenied(deps, sessionId),
    revocationChannel: sessionRevokedChannel(deps.keys),
    heartbeatMs: options.heartbeatMs,
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `ws://127.0.0.1:${port}/v1/realtime`,
    publisher: new RedisRealtimePublisher(deps.redis, channel, deps.logger),
    async close() {
      await realtime.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      subscriber.disconnect();
    },
  };
}

export interface TestSocket {
  socket: WebSocket;
  events: RealtimeEvent[];
  /** Resolves when the socket is open (rejects if it closes first). */
  opened: Promise<void>;
  closed: Promise<{ code: number; reason: string }>;
  /** Resolves with the next event (or the first unread one). */
  nextEvent(timeoutMs?: number): Promise<RealtimeEvent>;
}

export function connectSocket(url: string, token: string): TestSocket {
  const socket = new WebSocket(`${url}?token=${encodeURIComponent(token)}`);
  const events: RealtimeEvent[] = [];
  let read = 0;
  const waiters: (() => void)[] = [];
  socket.on('message', (data: Buffer) => {
    events.push(JSON.parse(data.toString()) as RealtimeEvent);
    waiters.splice(0).forEach((wake) => wake());
  });
  const closed = new Promise<{ code: number; reason: string }>((resolve) => {
    socket.on('close', (code, reason) => resolve({ code, reason: reason.toString() }));
  });
  const opened = new Promise<void>((resolve, reject) => {
    socket.once('open', () => resolve());
    socket.once('close', () => reject(new Error('socket closed before opening')));
  });
  opened.catch(() => undefined);
  return {
    socket,
    events,
    opened,
    closed,
    async nextEvent(timeoutMs = 2000) {
      const deadline = Date.now() + timeoutMs;
      while (read >= events.length) {
        if (Date.now() > deadline) throw new Error('no realtime event received');
        await new Promise<void>((resolve) => {
          waiters.push(resolve);
          setTimeout(resolve, 50);
        });
      }
      const event = events[read];
      read += 1;
      if (!event) throw new Error('no realtime event received');
      return event;
    },
  };
}
