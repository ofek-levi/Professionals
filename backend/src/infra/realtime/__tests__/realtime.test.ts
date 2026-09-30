import { afterAll, describe, expect, it } from 'vitest';

import { createTestDeps } from '../../../../test/app.js';
import { accessTokenFor } from '../../../../test/auth.js';
import { connectSocket, startRealtimeServer, type RealtimeTestServer } from '../../../../test/realtime.js';
import { signAccessToken } from '../../../lib/access-token.js';
import { newObjectId } from '../../../lib/ids.js';
import { denySessions } from '../../session-denylist.js';
import { CLOSE_UNAUTHORIZED, REALTIME_PROTOCOL } from '../realtime-server.js';

describe('realtime WebSocket endpoint', () => {
  const deps = createTestDeps();
  const servers: RealtimeTestServer[] = [];
  const start = async () => {
    const server = await startRealtimeServer(deps);
    servers.push(server);
    return server;
  };
  afterAll(async () => {
    await Promise.all(servers.map((server) => server.close()));
  });

  const alice = { _id: newObjectId(), role: 'customer' as const };
  const bob = { _id: newObjectId(), role: 'professional' as const };

  it('delivers published events only to the addressed users', async () => {
    const server = await start();
    const aliceSocket = connectSocket(server.url, accessTokenFor(deps, alice));
    const bobSocket = connectSocket(server.url, accessTokenFor(deps, bob));
    await Promise.all([aliceSocket.opened, bobSocket.opened]);

    await server.publisher.publish([alice._id.toHexString()], { type: 'request.updated', requestId: 'r1' });
    await server.publisher.publish([bob._id.toHexString()], { type: 'profile.updated', professionalId: 'p1' });

    expect(await aliceSocket.nextEvent()).toEqual({ type: 'request.updated', requestId: 'r1' });
    expect(await bobSocket.nextEvent()).toEqual({ type: 'profile.updated', professionalId: 'p1' });
    expect(aliceSocket.events).toHaveLength(1);
    aliceSocket.socket.close();
    bobSocket.socket.close();
  });

  it('takes the token from the bearer subprotocol, or from ?token= (older apps)', async () => {
    const server = await start();
    const viaProtocol = connectSocket(server.url, accessTokenFor(deps, alice));
    const viaQuery = connectSocket(server.url, accessTokenFor(deps, bob), { via: 'query' });
    await Promise.all([viaProtocol.opened, viaQuery.opened]);
    // The server answers with the app protocol only: the token is never echoed back.
    expect(viaProtocol.socket.protocol).toBe(REALTIME_PROTOCOL);
    expect(viaQuery.socket.protocol).toBe('');

    await server.publisher.publish([alice._id.toHexString(), bob._id.toHexString()], { type: 'request.updated', requestId: 'r1' });
    expect(await viaProtocol.nextEvent()).toEqual({ type: 'request.updated', requestId: 'r1' });
    expect(await viaQuery.nextEvent()).toEqual({ type: 'request.updated', requestId: 'r1' });
    viaProtocol.socket.close();
    viaQuery.socket.close();
  });

  it('fans out across API instances through Redis', async () => {
    const [first, second] = await Promise.all([start(), start()]);
    const onFirst = connectSocket(first.url, accessTokenFor(deps, alice));
    const onSecond = connectSocket(second.url, accessTokenFor(deps, alice));
    await Promise.all([onFirst.opened, onSecond.opened]);

    await first.publisher.publish([alice._id.toHexString()], { type: 'job.updated', jobId: 'j1', requestId: 'r1' });

    expect(await onFirst.nextEvent()).toMatchObject({ type: 'job.updated', jobId: 'j1' });
    expect(await onSecond.nextEvent()).toMatchObject({ type: 'job.updated', jobId: 'j1' });
    onFirst.socket.close();
    onSecond.socket.close();
  });

  it('closes with 4001 for a missing or invalid token', async () => {
    const server = await start();
    expect((await connectSocket(server.url, 'garbage').closed).code).toBe(CLOSE_UNAUTHORIZED);
    expect((await connectSocket(server.url, '').closed).code).toBe(CLOSE_UNAUTHORIZED);
    expect((await connectSocket(server.url, 'garbage', { via: 'query' }).closed).code).toBe(CLOSE_UNAUTHORIZED);
  });

  it('refuses the token of a revoked session with 4001', async () => {
    const server = await start();
    const sessionId = newObjectId().toHexString();
    const { token } = signAccessToken(deps.env.jwt, { userId: alice._id.toHexString(), role: 'customer', sessionId }, deps.clock);
    await denySessions(deps, [sessionId]);
    expect((await connectSocket(server.url, token).closed).code).toBe(CLOSE_UNAUTHORIZED);
  });

  it('closes the open sockets of a session when it is revoked (any instance)', async () => {
    const [first, second] = await Promise.all([start(), start()]);
    const sessionId = newObjectId().toHexString();
    const { token } = signAccessToken(deps.env.jwt, { userId: alice._id.toHexString(), role: 'customer', sessionId }, deps.clock);
    const other = connectSocket(second.url, accessTokenFor(deps, alice));
    const onFirst = connectSocket(first.url, token);
    const onSecond = connectSocket(second.url, token);
    await Promise.all([onFirst.opened, onSecond.opened, other.opened]);

    await denySessions(deps, [sessionId]);
    expect(await onFirst.closed).toEqual({ code: CLOSE_UNAUTHORIZED, reason: 'Session revoked' });
    expect(await onSecond.closed).toEqual({ code: CLOSE_UNAUTHORIZED, reason: 'Session revoked' });
    // Another session of the same user keeps its socket.
    await second.publisher.publish([alice._id.toHexString()], { type: 'request.updated', requestId: 'r2' });
    expect(await other.nextEvent()).toEqual({ type: 'request.updated', requestId: 'r2' });
    other.socket.close();
  });

  it('closes with 4001 when the access token expires', async () => {
    const server = await start();
    const issuedAt = deps.clock.now();
    const { token, expiresAt } = signAccessToken(
      deps.env.jwt,
      { userId: alice._id.toHexString(), role: 'customer', sessionId: 's' },
      deps.clock,
    );
    // Jump to 300 ms before expiry: the socket connects, then the expiry timer closes it.
    deps.clock.set(new Date(expiresAt.getTime() - 300));
    const socket = connectSocket(server.url, token);
    await socket.opened;
    const closed = await socket.closed;
    expect(closed).toEqual({ code: CLOSE_UNAUTHORIZED, reason: 'Token expired' });
    deps.clock.set(issuedAt);
  });
});
