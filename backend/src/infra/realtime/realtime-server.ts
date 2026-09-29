/**
 * WebSocket endpoint `GET /v1/realtime?token=<access token>` on the API's HTTP server.
 * - The access token is verified on connect; invalid or of a revoked session → close 4001. A socket
 *   is closed with 4001 when its token expires (the app reconnects with a fresh token) and when its
 *   session is revoked (ids announced on `revocationChannel`).
 * - Events arrive from Redis pub/sub (any instance may publish) and go to the local sockets of the
 *   addressed users. Frames are JSON `RealtimeEvent`s; client frames are ignored.
 * - Heartbeat: sockets that miss a pong between two pings are terminated.
 * The token is never logged (URLs are not logged here at all).
 */
import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';

import { WebSocketServer, type WebSocket } from 'ws';

import { verifyAccessToken, type AccessTokenConfig } from '../../lib/access-token.js';
import type { Clock } from '../../lib/clock.js';
import type { Logger } from '../../lib/logger.js';
import type { Redis } from '../redis.js';
import { ConnectionRegistry } from './connection-registry.js';
import type { RealtimeEnvelope } from './publisher.js';

export const REALTIME_PATH = '/v1/realtime';
export const CLOSE_UNAUTHORIZED = 4001;
const CLOSE_GOING_AWAY = 1001;

export interface RealtimeServerOptions {
  httpServer: Server;
  /** Dedicated connection (a subscribed Redis client cannot run other commands). */
  subscriber: Redis;
  channel: string;
  tokens: AccessTokenConfig;
  clock: Clock;
  logger: Logger;
  /** Revoked-session check (`infra/session-denylist.ts`); omitted → only the signature counts. */
  isSessionRevoked?: (sessionId: string) => Promise<boolean>;
  /** Pub/sub channel carrying JSON arrays of revoked session ids (`sessionRevokedChannel`). */
  revocationChannel?: string;
  heartbeatMs?: number;
}

export interface RealtimeServer {
  readonly connections: number;
  close(): Promise<void>;
}

function tokenFrom(request: IncomingMessage): string | null {
  const url = new URL(request.url ?? '/', 'http://localhost');
  return url.searchParams.get('token');
}

export async function attachRealtimeServer(options: RealtimeServerOptions): Promise<RealtimeServer> {
  const { httpServer, subscriber, channel, tokens, clock, logger } = options;
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4 * 1024 });
  const registry = new ConnectionRegistry();
  const alive = new WeakMap<WebSocket, boolean>();
  const bySession = new Map<string, Set<WebSocket>>();

  const accept = async (socket: WebSocket, request: IncomingMessage) => {
    const claims = verifyAccessToken(tokens, tokenFrom(request) ?? '', clock);
    if (!claims || (await options.isSessionRevoked?.(claims.sessionId))) {
      socket.close(CLOSE_UNAUTHORIZED, 'Unauthorized');
      return;
    }
    const { userId, sessionId } = claims;
    registry.add(userId, socket);
    const sessionSockets = bySession.get(sessionId) ?? new Set<WebSocket>();
    bySession.set(sessionId, sessionSockets.add(socket));
    alive.set(socket, true);
    const expiresInMs = claims.expiresAt * 1000 - clock.now().getTime();
    const expiry = setTimeout(() => socket.close(CLOSE_UNAUTHORIZED, 'Token expired'), Math.max(0, expiresInMs));
    expiry.unref();
    socket.on('pong', () => alive.set(socket, true));
    socket.on('error', (error) => logger.debug({ err: error, userId }, 'realtime socket error'));
    socket.on('close', () => {
      clearTimeout(expiry);
      registry.remove(userId, socket);
      sessionSockets.delete(socket);
      if (sessionSockets.size === 0) bySession.delete(sessionId);
    });
  };

  const onUpgrade = (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const { pathname } = new URL(request.url ?? '/', 'http://localhost');
    if (pathname !== REALTIME_PATH) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      accept(ws, request).catch((error: unknown) => {
        logger.warn({ err: error }, 'realtime connection refused');
        ws.close(CLOSE_UNAUTHORIZED, 'Unauthorized');
      });
    });
  };
  httpServer.on('upgrade', onUpgrade);

  const closeRevoked = (message: string) => {
    for (const sessionId of JSON.parse(message) as string[]) {
      for (const socket of bySession.get(sessionId) ?? []) socket.close(CLOSE_UNAUTHORIZED, 'Session revoked');
    }
  };

  const onMessage = (receivedChannel: string, message: string) => {
    if (receivedChannel === options.revocationChannel) {
      try {
        closeRevoked(message);
      } catch (error) {
        logger.warn({ err: error }, 'invalid session revocation message');
      }
      return;
    }
    if (receivedChannel !== channel) return;
    try {
      const envelope = JSON.parse(message) as RealtimeEnvelope;
      registry.deliver(envelope.userIds, JSON.stringify(envelope.event));
    } catch (error) {
      logger.warn({ err: error }, 'invalid realtime envelope');
    }
  };
  subscriber.on('message', onMessage);
  await subscriber.subscribe(...[channel, options.revocationChannel].filter((name): name is string => name !== undefined));

  const heartbeat = setInterval(() => {
    for (const socket of registry.all()) {
      if (alive.get(socket) === false) {
        socket.terminate();
        continue;
      }
      alive.set(socket, false);
      socket.ping();
    }
  }, options.heartbeatMs ?? 30_000);
  heartbeat.unref();

  return {
    get connections() {
      return registry.size;
    },
    async close() {
      clearInterval(heartbeat);
      httpServer.off('upgrade', onUpgrade);
      subscriber.off('message', onMessage);
      await subscriber.unsubscribe().catch(() => undefined);
      for (const socket of registry.all()) socket.close(CLOSE_GOING_AWAY, 'Server shutting down');
      await new Promise<void>((resolve) => {
        wss.close(() => {
          resolve();
        });
      });
    },
  };
}
