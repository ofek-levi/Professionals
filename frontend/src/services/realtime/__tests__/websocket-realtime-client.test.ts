/**
 * The realtime WebSocket client: token in the URL, frame parsing, 4001 → refresh → reconnect
 * (stopping when the session is over), capped exponential backoff with jitter for other drops,
 * foreground/background handling, `onReconnect`, and `disconnect()`.
 */
import type { AppStateStatus } from 'react-native';

import { parseRealtimeFrame, reconnectDelayMs } from '../realtime-frames';
import type { RealtimeEvent } from '../types';
import { CLOSE_UNAUTHORIZED, createWebSocketRealtimeClient, type OpenSocket, type RealtimeAuth } from '../websocket-realtime-client';

const URL = 'wss://api.example.com/v1/realtime';

interface FakeSocket {
  url: string;
  token: string;
  handlers: Parameters<OpenSocket>[1];
  close: jest.Mock;
}

function setup(options: { auth?: Partial<RealtimeAuth>; random?: number; closeInBackground?: boolean } = {}) {
  const sockets: FakeSocket[] = [];
  const openSocket: OpenSocket = (url, handlers) => {
    const socket: FakeSocket = { url, token: new globalThis.URL(url).searchParams.get('token') ?? '', handlers, close: jest.fn() };
    sockets.push(socket);
    return socket;
  };
  let appStateListener: ((status: AppStateStatus) => void) | null = null;
  let token = 'token-1';
  let refreshes = 1;
  const auth: RealtimeAuth = {
    getAccessToken: jest.fn(async () => token),
    handleUnauthorized: jest.fn(async () => {
      refreshes += 1;
      token = `token-${refreshes}`;
      return token;
    }),
    ...options.auth,
  };
  const client = createWebSocketRealtimeClient({
    url: URL,
    auth,
    openSocket,
    appState: (listener) => {
      appStateListener = listener;
      return () => {
        appStateListener = null;
      };
    },
    closeInBackground: options.closeInBackground ?? true,
    random: () => options.random ?? 0,
    now: () => Date.now(),
  });
  const events: RealtimeEvent[] = [];
  client.subscribe((event) => events.push(event));
  const reconnected = jest.fn();
  client.onReconnect(reconnected);
  return {
    client,
    auth,
    sockets,
    events,
    reconnected,
    last: () => sockets[sockets.length - 1],
    setAppState: (status: AppStateStatus) => appStateListener?.(status),
    hasAppStateListener: () => appStateListener !== null,
  };
}

/** Lets pending promises and timers up to `ms` run. */
const run = (ms = 0) => jest.advanceTimersByTimeAsync(ms);

const event: RealtimeEvent = { type: 'request.updated', requestId: 'req_1' };

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('connecting', () => {
  it('opens one socket with the URL-encoded access token and delivers valid frames', async () => {
    const t = setup({ auth: { getAccessToken: async () => 'a+b/c=' } });
    t.client.connect();
    t.client.connect(); // idempotent
    await run();
    expect(t.sockets).toHaveLength(1);
    expect(t.last().url).toBe(`${URL}?token=a%2Bb%2Fc%3D`);

    t.last().handlers.onOpen();
    t.last().handlers.onMessage(JSON.stringify(event));
    t.last().handlers.onMessage('not json');
    t.last().handlers.onMessage(JSON.stringify({ type: 'something.else' }));
    t.last().handlers.onMessage(new ArrayBuffer(4));
    expect(t.events).toEqual([event]);
    expect(t.reconnected).not.toHaveBeenCalled();
  });

  it('keeps delivering to the other listeners when one throws', async () => {
    const t = setup();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    t.client.subscribe(() => {
      throw new Error('boom');
    });
    const late = jest.fn();
    t.client.subscribe(late);
    t.client.connect();
    await run();
    t.last().handlers.onMessage(JSON.stringify(event));
    expect(t.events).toEqual([event]);
    expect(late).toHaveBeenCalledWith(event);
    warn.mockRestore();
  });

  it('does not connect without a session', async () => {
    const t = setup({ auth: { getAccessToken: async () => null } });
    t.client.connect();
    await run(60_000);
    expect(t.sockets).toHaveLength(0);
  });
});

describe('close 4001 (token expired or session revoked)', () => {
  it('refreshes the token and reconnects right away with the new one', async () => {
    const t = setup();
    t.client.connect();
    await run();
    t.last().handlers.onOpen();
    jest.advanceTimersByTime(10 * 60_000); // a healthy connection, then its token expires
    t.last().handlers.onClose(CLOSE_UNAUTHORIZED);
    await run();
    expect(t.auth.handleUnauthorized).toHaveBeenCalledWith('token-1');
    expect(t.sockets.map((socket) => socket.token)).toEqual(['token-1', 'token-2']);
    t.last().handlers.onOpen();
    expect(t.reconnected).toHaveBeenCalledTimes(1);
  });

  it('backs off instead of looping when the fresh token is refused at once too', async () => {
    const t = setup();
    t.client.connect();
    await run();
    t.last().handlers.onOpen();
    t.last().handlers.onClose(CLOSE_UNAUTHORIZED);
    await run();
    expect(t.sockets).toHaveLength(2);
    t.last().handlers.onOpen();
    t.last().handlers.onClose(CLOSE_UNAUTHORIZED); // within 5 s of opening
    await run();
    expect(t.sockets).toHaveLength(2);
    await run(500); // attempt 0 with random() = 0: half of 1 s
    expect(t.sockets).toHaveLength(3);
  });

  it('stops for good when the refresh says the session is over', async () => {
    const t = setup({ auth: { handleUnauthorized: jest.fn(async () => null) } });
    t.client.connect();
    await run();
    t.last().handlers.onOpen();
    t.last().handlers.onClose(CLOSE_UNAUTHORIZED);
    await run(10 * 60_000);
    expect(t.sockets).toHaveLength(1);
    t.setAppState('active');
    await run();
    expect(t.sockets).toHaveLength(1);
  });

  it('retries later with whatever token is current when the refresh cannot reach the server', async () => {
    const offline = jest.fn(async () => Promise.reject(new Error('offline')));
    const t = setup({ auth: { handleUnauthorized: offline } });
    t.client.connect();
    await run();
    t.last().handlers.onClose(CLOSE_UNAUTHORIZED);
    await run();
    expect(t.sockets).toHaveLength(1);
    await run(500);
    expect(t.sockets).toHaveLength(2);
  });
});

describe('other drops (1001 server restart, network loss)', () => {
  it('reconnects with capped exponential backoff and refetches after the reconnect', async () => {
    const t = setup({ random: 0 });
    t.client.connect();
    await run();
    t.last().handlers.onOpen();
    // Never opens again: every attempt fails → 0.5 s, 1 s, 2 s, 4 s, 8 s, 15 s, 15 s (cap 30 s / 2).
    const delays: number[] = [];
    for (let attempt = 0; attempt < 7; attempt += 1) {
      const before = t.sockets.length;
      t.last().handlers.onClose(attempt === 0 ? 1001 : 1006);
      let waited = 0;
      while (t.sockets.length === before) {
        await run(100);
        waited += 100;
      }
      delays.push(waited);
    }
    expect(delays).toEqual([500, 1000, 2000, 4000, 8000, 15_000, 15_000]);
    t.last().handlers.onOpen();
    expect(t.reconnected).toHaveBeenCalledTimes(1);
    // A successful open resets the backoff.
    t.last().handlers.onClose(1001);
    await run(500);
    expect(t.sockets).toHaveLength(9);
  });

  it('spreads reconnects with jitter between half and all of the capped delay', () => {
    expect(reconnectDelayMs(0, () => 0)).toBe(500);
    expect(reconnectDelayMs(0, () => 1)).toBe(1000);
    expect(reconnectDelayMs(3, () => 0.5)).toBe(6000);
    expect(reconnectDelayMs(20, () => 1)).toBe(30_000);
    expect(reconnectDelayMs(20, () => 0)).toBe(15_000);
    expect(reconnectDelayMs(-1, () => 0)).toBe(500);
  });
});

describe('app state and disconnect', () => {
  it('closes the socket in the background and reconnects at once in the foreground', async () => {
    const t = setup();
    t.client.connect();
    await run();
    t.last().handlers.onOpen();
    t.setAppState('background');
    expect(t.last().close).toHaveBeenCalledWith(1000, 'Client closed');
    t.last().handlers.onClose(1000);
    await run(5 * 60_000);
    expect(t.sockets).toHaveLength(1);

    t.setAppState('active');
    await run();
    expect(t.sockets).toHaveLength(2);
    t.last().handlers.onOpen();
    expect(t.reconnected).toHaveBeenCalledTimes(1);
  });

  it('reconnects at once when the app returns while a backoff is pending', async () => {
    const t = setup({ closeInBackground: false });
    t.client.connect();
    await run();
    t.last().handlers.onOpen();
    for (let i = 0; i < 4; i += 1) {
      t.last().handlers.onClose(1006);
      await run(30_000);
    }
    const count = t.sockets.length;
    t.last().handlers.onClose(1006); // next attempt would wait 8–16 s
    t.setAppState('active');
    await run();
    expect(t.sockets).toHaveLength(count + 1);
  });

  it('keeps the socket open in the background on the web', async () => {
    const t = setup({ closeInBackground: false });
    t.client.connect();
    await run();
    t.setAppState('background');
    expect(t.last().close).not.toHaveBeenCalled();
  });

  it('disconnect() closes the socket, cancels a pending reconnect and drops a late token', async () => {
    let resolveToken: (token: string) => void = () => undefined;
    const t = setup();
    t.client.connect();
    await run();
    t.last().handlers.onClose(1006);
    t.client.disconnect();
    await run(60_000);
    expect(t.sockets).toHaveLength(1);
    expect(t.hasAppStateListener()).toBe(false);

    const slow = setup({ auth: { getAccessToken: () => new Promise<string>((resolve) => (resolveToken = resolve)) } });
    slow.client.connect();
    slow.client.disconnect();
    resolveToken('late-token');
    await run();
    expect(slow.sockets).toHaveLength(0);
  });

  it('closes the open socket on disconnect and can connect again (next sign-in)', async () => {
    const t = setup();
    t.client.connect();
    await run();
    const first = t.last();
    first.handlers.onOpen();
    t.client.disconnect();
    expect(first.close).toHaveBeenCalledWith(1000, 'Client closed');
    first.handlers.onClose(1000); // late close event of the old socket: ignored
    t.client.connect();
    await run();
    expect(t.sockets).toHaveLength(2);
    t.last().handlers.onOpen();
    expect(t.reconnected).not.toHaveBeenCalled(); // a new session, not a reconnect
  });
});

describe('frames', () => {
  it('accepts exactly the RealtimeEvent types', () => {
    const frames: RealtimeEvent[] = [
      { type: 'notification.created', notification: {} as never },
      { type: 'message.created', message: {} as never },
      { type: 'conversation.read', conversationId: 'c', readerId: 'u', readAt: '2026-09-30T10:00:00.000Z' },
      { type: 'request.updated', requestId: 'r' },
      { type: 'offer.updated', offerId: 'o', requestId: 'r' },
      { type: 'job.updated', jobId: 'j', requestId: 'r' },
      { type: 'profile.updated', professionalId: 'p' },
    ];
    for (const frame of frames) expect(parseRealtimeFrame(JSON.stringify(frame))).toEqual(frame);
    for (const raw of ['', 'null', '[]', '42', '{"type":1}', '{"kind":"request.updated"}']) expect(parseRealtimeFrame(raw)).toBeNull();
    expect(parseRealtimeFrame({ type: 'request.updated' })).toBeNull();
  });
});
