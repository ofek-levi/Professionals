import { connect, type Socket } from 'node:net';

import { afterAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';

import { createTestDeps } from '../../../../test/app.js';
import { accessTokenFor } from '../../../../test/auth.js';
import { connectSocket, startRealtimeServer, type RealtimeTestServer } from '../../../../test/realtime.js';
import { newObjectId } from '../../../lib/ids.js';
import { realtimeUpgradeLimiter, RATE_LIMITS } from '../../../middleware/rate-limit.js';
import { CLOSE_TOO_MANY_CONNECTIONS } from '../realtime-server.js';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A client socket whose connection errors are expected (it is cut or refused on purpose). */
function expendableSocket(url: string, token: string): WebSocket {
  const socket = new WebSocket(`${url}?token=${encodeURIComponent(token)}`);
  socket.on('error', () => undefined);
  return socket;
}

/** A raw TCP client that completes the WebSocket handshake, then never reads again. */
async function silentClient(url: string, token: string): Promise<Socket> {
  const { hostname, port, pathname } = new URL(url);
  const socket = connect(Number(port), hostname);
  await new Promise<void>((resolve) => socket.once('connect', resolve));
  socket.write(
    `GET ${pathname}?token=${encodeURIComponent(token)} HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n` +
      'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n',
  );
  await new Promise<void>((resolve) => socket.once('data', () => resolve()));
  socket.pause();
  return socket;
}

describe('realtime connection limits and lifecycle', () => {
  const deps = createTestDeps();
  const servers: RealtimeTestServer[] = [];
  const start = async (options: Parameters<typeof startRealtimeServer>[1] = {}) => {
    const server = await startRealtimeServer(deps, options);
    servers.push(server);
    return server;
  };
  afterAll(async () => {
    await Promise.all(servers.map((server) => server.close()));
  });
  const user = () => ({ _id: newObjectId(), role: 'customer' as const });

  it('keeps no socket of a client that leaves while its session is being checked', async () => {
    const slowCheck = () => wait(100).then(() => false);
    const server = await start({ isSessionRevoked: slowCheck });
    const token = accessTokenFor(deps, user());
    const leavers = Array.from({ length: 5 }, () => expendableSocket(server.url, token));
    await wait(20);
    for (const socket of leavers) socket.terminate();
    const stayer = connectSocket(server.url, token);
    await stayer.opened;
    await wait(200);
    expect(server.realtime.connections).toBe(1);
    stayer.socket.close();
    await stayer.closed;
    await wait(20);
    expect(server.realtime.connections).toBe(0);
  });

  it('caps the sockets of one user and refuses upgrades over the throttle with 429', async () => {
    const server = await start({ maxSocketsPerUser: 2 });
    const token = accessTokenFor(deps, user());
    const [first, second] = [connectSocket(server.url, token), connectSocket(server.url, token)];
    await Promise.all([first.opened, second.opened]);
    const third = connectSocket(server.url, token);
    expect((await third.closed).code).toBe(CLOSE_TOO_MANY_CONNECTIONS);
    expect(server.realtime.connections).toBe(2);

    const throttled = await start({ allowUpgrade: () => Promise.resolve(false) });
    const refused = expendableSocket(throttled.url, token);
    const status = await new Promise<number>((resolve) => refused.once('unexpected-response', (_req, res) => resolve(res.statusCode ?? 0)));
    expect(status).toBe(429);
    refused.terminate();
    first.socket.close();
    second.socket.close();
  });

  it('counts upgrades per user in Redis (shared by every instance)', async () => {
    const limited = createTestDeps({ env: { RATE_LIMIT_ENABLED: 'true' } });
    const allow = realtimeUpgradeLimiter(limited);
    expect(allow).toBeDefined();
    const userId = newObjectId().toHexString();
    const results: boolean[] = [];
    for (let i = 0; i <= RATE_LIMITS.realtimeUpgradesPerUser.limit; i += 1) results.push((await allow?.(userId)) ?? true);
    expect(results.filter((allowed) => !allowed)).toHaveLength(1);
    expect(await allow?.(newObjectId().toHexString())).toBe(true);
    expect(realtimeUpgradeLimiter(createTestDeps())).toBeUndefined();
  });

  it('shuts down promptly although a client never answers the close frame', async () => {
    const server = await startRealtimeServer(deps, { closeGraceMs: 200 });
    const silent = await silentClient(server.url, accessTokenFor(deps, user()));
    const polite = connectSocket(server.url, accessTokenFor(deps, user()));
    await polite.opened;
    expect(server.realtime.connections).toBe(2);
    const started = Date.now();
    await server.close();
    expect(Date.now() - started).toBeLessThan(2000);
    expect((await polite.closed).code).toBe(1001);
    silent.destroy();
  });
});
