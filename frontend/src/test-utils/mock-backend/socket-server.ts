/**
 * The realtime endpoint of the test double (`/v1/realtime?token=<access token>`), plugged into the
 * app's own WebSocket client through its `openSocket` option. Like the backend:
 * - a missing, invalid, expired or revoked token closes the socket with 4001 right after it opens;
 * - frames are the JSON `RealtimeEvent`s of the connected user, delivered asynchronously after the
 *   change was committed;
 * - signing out or revoking the session closes its sockets with 4001, and so does an event arriving
 *   after the socket's token expired;
 * - `dropAll(1001)` simulates a server restart (or 1006 a lost network).
 */
import type { RealtimeEvent } from '@/services/realtime/types';
import type { OpenSocket } from '@/services/realtime/websocket-realtime-client';

import type { InternalMockServer } from './server';
import { sessionOfAccessToken } from './server/sessions';

export const CLOSE_UNAUTHORIZED = 4001;
export const CLOSE_GOING_AWAY = 1001;

export interface MockSocket {
  readonly token: string;
  readonly userId: string | null;
  readonly sessionId: string | null;
  /** Closed by either side. */
  readonly closed: boolean;
  /** The server closes the socket with `code`. */
  drop(code: number): void;
}

export interface MockSocketServer {
  openSocket: OpenSocket;
  /** Every socket opened so far (oldest first). */
  readonly sockets: readonly MockSocket[];
  /** The sockets that are still open. */
  open(): MockSocket[];
  /** Closes every open socket with `code` (default 1001: server restart). */
  dropAll(code?: number): void;
}

const later = (callback: () => void) => {
  setTimeout(callback, 0);
};

export function createMockSocketServer(server: InternalMockServer): MockSocketServer {
  const sockets: MockSocket[] = [];

  const openSocket: OpenSocket = (url, handlers) => {
    const token = new URL(url).searchParams.get('token') ?? '';
    const { db, now } = server.internals;
    const session = sessionOfAccessToken(db, token, now());
    let closed = false;
    let stopEvents: (() => void) | null = null;
    let stopRevocations: (() => void) | null = null;

    const finish = (code: number, notify: boolean) => {
      if (closed) return;
      closed = true;
      stopEvents?.();
      stopRevocations?.();
      if (notify) later(() => handlers.onClose(code));
    };

    const socket: MockSocket = {
      token,
      userId: session?.userId ?? null,
      sessionId: session?.id ?? null,
      get closed() {
        return closed;
      },
      drop: (code) => finish(code, true),
    };
    sockets.push(socket);

    later(() => {
      if (closed) return;
      handlers.onOpen();
      if (!session) {
        finish(CLOSE_UNAUTHORIZED, true);
        return;
      }
      const deliver = (event: RealtimeEvent) => {
        const frame = JSON.stringify(event);
        later(() => {
          if (closed) return;
          if (!sessionOfAccessToken(db, token, now())) finish(CLOSE_UNAUTHORIZED, true);
          else handlers.onMessage(frame);
        });
      };
      stopEvents = server.events.subscribe(session.userId, deliver);
      stopRevocations = server.events.onSessionRevoked((sessionId) => {
        if (sessionId === session.id) finish(CLOSE_UNAUTHORIZED, true);
      });
    });

    return { close: (code) => finish(code, true) };
  };

  return {
    openSocket,
    sockets,
    open: () => sockets.filter((socket) => !socket.closed),
    dropAll(code = CLOSE_GOING_AWAY) {
      sockets.filter((socket) => !socket.closed).forEach((socket) => socket.drop(code));
    },
  };
}
