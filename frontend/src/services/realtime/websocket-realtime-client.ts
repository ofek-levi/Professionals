/**
 * The realtime connection: `ws(s)://…/v1/realtime?token=<access token>`, JSON `RealtimeEvent` frames.
 *
 * - Close 4001 (token expired, session revoked): the token is refreshed (`auth.handleUnauthorized`)
 *   and the socket reopened with the new one; when the refresh fails the session is over and the
 *   client stops (the session lifecycle disconnects it on sign-out anyway).
 * - Any other close (1001 server restart, network loss): reconnect with capped exponential backoff
 *   plus jitter.
 * - Back in the foreground: reconnect right away. On iOS/Android the socket is closed while the app
 *   is in the background (the OS would freeze it anyway; pushes cover that time).
 * - After a reconnect `onReconnect` listeners refetch what they show (events may have been missed).
 */
import { AppState, Platform, type AppStateStatus } from 'react-native';

import { DEFAULT_BACKOFF, parseRealtimeFrame, reconnectDelayMs, type BackoffOptions } from './realtime-frames';
import type { RealtimeClient, RealtimeEvent, RealtimeListener } from './types';

/** Close code of the server for a missing, expired or revoked token. */
export const CLOSE_UNAUTHORIZED = 4001;
const CLOSE_NORMAL = 1000;
/** A socket that stayed open this long was healthy: its 4001 is a plain expiry, not a loop. */
const HEALTHY_CONNECTION_MS = 5_000;

export interface RealtimeAuth {
  getAccessToken(): Promise<string | null>;
  handleUnauthorized(rejectedToken: string): Promise<string | null>;
}

interface SocketHandlers {
  onOpen(): void;
  onMessage(data: unknown): void;
  onClose(code: number): void;
}

interface SocketConnection {
  close(code: number, reason: string): void;
}

export type OpenSocket = (url: string, handlers: SocketHandlers) => SocketConnection;

type AppStateSource = (listener: (status: AppStateStatus) => void) => () => void;

export interface WebSocketRealtimeOptions {
  /** `ws(s)://…/v1/realtime` */
  url: string;
  auth: RealtimeAuth;
  openSocket?: OpenSocket;
  appState?: AppStateSource;
  /** Close the socket while the app is in the background (default: on iOS/Android). */
  closeInBackground?: boolean;
  backoff?: BackoffOptions;
  random?: () => number;
  now?: () => number;
}

const openWebSocket: OpenSocket = (url, handlers) => {
  const socket = new WebSocket(url);
  socket.onopen = () => handlers.onOpen();
  socket.onmessage = (event) => handlers.onMessage(event.data);
  socket.onclose = (event) => handlers.onClose(event.code);
  socket.onerror = () => undefined; // A close event follows.
  return { close: (code, reason) => socket.close(code, reason) };
};

const nativeAppState: AppStateSource = (listener) => {
  const subscription = AppState.addEventListener('change', listener);
  return () => subscription.remove();
};

export function createWebSocketRealtimeClient({
  url,
  auth,
  openSocket = openWebSocket,
  appState = nativeAppState,
  closeInBackground = Platform.OS !== 'web',
  backoff = DEFAULT_BACKOFF,
  random = Math.random,
  now = Date.now,
}: WebSocketRealtimeOptions): RealtimeClient {
  const listeners = new Set<RealtimeListener>();
  const reconnectListeners = new Set<() => void>();
  let wanted = false;
  /** In the background (iOS/Android): no socket until the app is active again. */
  let suspended = false;
  let connection: SocketConnection | null = null;
  let connecting = false;
  /** Bumped by `disconnect()` and backgrounding: late results of an older attempt are dropped. */
  let generation = 0;
  let attempt = 0;
  let unauthorizedStreak = 0;
  let wasConnected = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopAppState: (() => void) | null = null;

  const emit = (event: RealtimeEvent) => {
    listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        if (__DEV__) console.warn('[realtime] listener failed', error);
      }
    });
  };

  const clearTimer = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  const scheduleReconnect = () => {
    clearTimer();
    if (!wanted || suspended) return;
    timer = setTimeout(() => void open(), reconnectDelayMs(attempt, random, backoff));
    attempt += 1;
  };

  const handleClose = async (code: number, token: string, openedAt: number | null, current: number) => {
    if (!wanted || current !== generation) return;
    if (code !== CLOSE_UNAUTHORIZED) {
      scheduleReconnect();
      return;
    }
    if (openedAt !== null && now() - openedAt >= HEALTHY_CONNECTION_MS) unauthorizedStreak = 0;
    let next: string | null;
    try {
      next = await auth.handleUnauthorized(token);
    } catch {
      scheduleReconnect(); // Offline: retry later with whatever token is current then.
      return;
    }
    if (!wanted || current !== generation) return;
    if (!next) {
      wanted = false; // The session is over.
      return;
    }
    unauthorizedStreak += 1;
    if (unauthorizedStreak > 1) scheduleReconnect();
    else void open();
  };

  async function open(): Promise<void> {
    clearTimer();
    if (!wanted || suspended || connection || connecting) return;
    connecting = true;
    const current = generation;
    let token: string | null;
    try {
      token = await auth.getAccessToken();
    } catch {
      token = null;
      connecting = false;
      if (current === generation) scheduleReconnect();
      return;
    }
    connecting = false;
    if (current !== generation) {
      void open(); // Backgrounded or reconnected meanwhile: start over with the current state.
      return;
    }
    if (!wanted || suspended || connection) return;
    if (!token) {
      wanted = false; // Signed out.
      return;
    }
    const socketToken = token;
    let openedAt: number | null = null;
    const socket = openSocket(`${url}?token=${encodeURIComponent(socketToken)}`, {
      onOpen: () => {
        openedAt = now();
        attempt = 0;
        if (wasConnected) reconnectListeners.forEach((listener) => listener());
        wasConnected = true;
      },
      onMessage: (data) => {
        const event = parseRealtimeFrame(data);
        if (event) emit(event);
      },
      onClose: (code) => {
        if (connection !== socket) return;
        connection = null;
        void handleClose(code, socketToken, openedAt, current);
      },
    });
    connection = socket;
  }

  const closeConnection = () => {
    const socket = connection;
    connection = null;
    socket?.close(CLOSE_NORMAL, 'Client closed');
  };

  const onAppStateChange = (status: AppStateStatus) => {
    if (!wanted) return;
    if (status === 'active') {
      suspended = false;
      attempt = 0;
      unauthorizedStreak = 0;
      void open();
    } else if (status === 'background' && closeInBackground) {
      suspended = true;
      generation += 1;
      clearTimer();
      closeConnection();
    }
  };

  return {
    connect() {
      if (wanted) return;
      wanted = true;
      suspended = false;
      wasConnected = false;
      attempt = 0;
      unauthorizedStreak = 0;
      stopAppState ??= appState(onAppStateChange);
      void open();
    },
    disconnect() {
      wanted = false;
      generation += 1;
      clearTimer();
      stopAppState?.();
      stopAppState = null;
      closeConnection();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    onReconnect(listener) {
      reconnectListeners.add(listener);
      return () => {
        reconnectListeners.delete(listener);
      };
    },
  };
}
