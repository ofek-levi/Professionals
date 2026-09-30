/**
 * WebSocket endpoint `GET /v1/realtime` on the API's HTTP server. The access token travels as a
 * subprotocol (`Sec-WebSocket-Protocol: professionals.v1, bearer.<JWT>`; the server selects
 * `professionals.v1`), so it is not in the URL that proxies log and browsers print; `?token=` is
 * still accepted from older app versions.
 * - The access token is verified on connect; invalid or of a revoked session → close 4001. A socket
 *   is closed with 4001 when its token expires (the app reconnects with a fresh token) and when its
 *   session is revoked (ids announced on `revocationChannel`).
 * - Every asynchronous check (revoked session, upgrade throttle) runs BEFORE the handshake, so a
 *   socket is registered synchronously once it exists: a client that leaves during a check never
 *   leaves an unobserved socket behind. Upgrades are throttled per user (`allowUpgrade`, over the
 *   limit → HTTP 429 without a handshake) and each user holds at most `maxSocketsPerUser` sockets
 *   per instance (more → close 1008).
 * - Events arrive from Redis pub/sub (any instance may publish) and go to the local sockets of the
 *   addressed users. Frames are JSON `RealtimeEvent`s; client frames are ignored.
 * - Heartbeat: sockets that miss a pong between two pings are terminated.
 * - `close()` sends 1001 and gives clients `closeGraceMs` to answer before cutting the rest, so a
 *   silent peer (backgrounded phone, half-open TCP) never holds a shutdown for ws's 30 s timeout.
 * The token is never logged (URLs are not logged here at all).
 */
import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';

import { WebSocket, WebSocketServer } from 'ws';

import { verifyAccessToken, type AccessTokenClaims, type AccessTokenConfig } from '../../lib/access-token.js';
import type { Clock } from '../../lib/clock.js';
import type { Logger } from '../../lib/logger.js';
import type { Redis } from '../redis.js';
import { ConnectionRegistry } from './connection-registry.js';
import type { RealtimeEnvelope } from './publisher.js';

export const REALTIME_PATH = '/v1/realtime';
/** The subprotocol the app offers and the server selects (the token comes as `bearer.<JWT>`). */
export const REALTIME_PROTOCOL = 'professionals.v1';
const BEARER_PROTOCOL_PREFIX = 'bearer.';
export const CLOSE_UNAUTHORIZED = 4001;
export const CLOSE_TOO_MANY_CONNECTIONS = 1008;
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
  /** Upgrade throttle for a verified user (shared across instances); omitted → unlimited. */
  allowUpgrade?: (userId: string) => Promise<boolean>;
  /** Open sockets per user on one instance (default 10: phones, tablets and browser tabs). */
  maxSocketsPerUser?: number;
  /** Time given to clients to answer the shutdown close frame (default 1 s). */
  closeGraceMs?: number;
  heartbeatMs?: number;
}

export interface RealtimeServer {
  readonly connections: number;
  close(): Promise<void>;
}

type Admission = { claims: AccessTokenClaims } | { refused: 'unauthorized' | 'throttled' };

function tokenFrom(request: IncomingMessage): string | null {
  const offered = (request.headers['sec-websocket-protocol'] ?? '').split(',').map((protocol) => protocol.trim());
  const bearer = offered.find((protocol) => protocol.startsWith(BEARER_PROTOCOL_PREFIX));
  if (bearer) return bearer.slice(BEARER_PROTOCOL_PREFIX.length);
  // Older app versions put it in the URL (keep that out of access logs: OPERATIONS.md §4).
  return new URL(request.url ?? '/', 'http://localhost').searchParams.get('token');
}

function rejectUpgrade(socket: Duplex, status: number, message: string): void {
  socket.end(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
}

/** Resolves once every socket closed, or after `ms`. */
function closedOrTimeout(sockets: readonly WebSocket[], ms: number): Promise<void> {
  const open = sockets.filter((socket) => socket.readyState !== WebSocket.CLOSED);
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    void Promise.all(open.map((socket) => new Promise((done) => socket.once('close', done)))).then(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}

export async function attachRealtimeServer(options: RealtimeServerOptions): Promise<RealtimeServer> {
  const { httpServer, subscriber, channel, tokens, clock, logger } = options;
  const maxSocketsPerUser = options.maxSocketsPerUser ?? 10;
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 4 * 1024,
    // Never echo the bearer subprotocol (the token) back: only the app's protocol is selected.
    handleProtocols: (protocols) => (protocols.has(REALTIME_PROTOCOL) ? REALTIME_PROTOCOL : false),
  });
  const registry = new ConnectionRegistry();
  const alive = new WeakMap<WebSocket, boolean>();
  const bySession = new Map<string, Set<WebSocket>>();

  const admit = async (request: IncomingMessage): Promise<Admission> => {
    const claims = verifyAccessToken(tokens, tokenFrom(request) ?? '', clock);
    if (!claims) return { refused: 'unauthorized' };
    const [allowed, revoked] = await Promise.all([options.allowUpgrade?.(claims.userId) ?? true, options.isSessionRevoked?.(claims.sessionId) ?? false]);
    if (revoked) return { refused: 'unauthorized' };
    return allowed ? { claims } : { refused: 'throttled' };
  };

  /** Synchronous from the handshake on: the close handler is attached before anything can happen. */
  const register = (socket: WebSocket, { userId, sessionId, expiresAt }: AccessTokenClaims) => {
    if (registry.countFor(userId) >= maxSocketsPerUser) {
      socket.close(CLOSE_TOO_MANY_CONNECTIONS, 'Too many connections');
      return;
    }
    registry.add(userId, socket);
    const sessionSockets = bySession.get(sessionId) ?? new Set<WebSocket>();
    bySession.set(sessionId, sessionSockets.add(socket));
    alive.set(socket, true);
    const expiry = setTimeout(() => socket.close(CLOSE_UNAUTHORIZED, 'Token expired'), Math.max(0, expiresAt * 1000 - clock.now().getTime()));
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
    admit(request)
      .catch((error: unknown): Admission => {
        logger.warn({ err: error }, 'realtime connection refused');
        return { refused: 'unauthorized' };
      })
      .then((admission) => {
        if (socket.destroyed) return; // the client left during the checks: nothing to clean up
        if ('refused' in admission && admission.refused === 'throttled') {
          rejectUpgrade(socket, 429, 'Too Many Requests');
          return;
        }
        wss.handleUpgrade(request, socket, head, (ws) => {
          if ('claims' in admission) register(ws, admission.claims);
          else ws.close(CLOSE_UNAUTHORIZED, 'Unauthorized');
        });
      })
      .catch((error: unknown) => {
        logger.warn({ err: error }, 'realtime upgrade failed');
        socket.destroy();
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
      const sockets = [...wss.clients];
      for (const socket of sockets) socket.close(CLOSE_GOING_AWAY, 'Server shutting down');
      // Clients reconnect to another instance anyway: whoever has not answered by now is cut.
      await closedOrTimeout(sockets, options.closeGraceMs ?? 1000);
      for (const socket of wss.clients) socket.terminate();
      await new Promise<void>((resolve) => {
        wss.close(() => resolve());
      });
    },
  };
}
