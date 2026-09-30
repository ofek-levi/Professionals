/**
 * Queued server sign-outs are sent again at launch, after each sign-in, when the app returns to
 * the foreground and when the browser is back online.
 */
import { AppState, type AppStateStatus } from 'react-native';

import type { SessionState } from '@/services/auth/session-store';

import { startPendingLogoutRetries } from '../pending-logout-retries';

describe('startPendingLogoutRetries', () => {
  it('flushes at start, on sign-in, on foreground and when back online, until stopped', () => {
    const flush = jest.fn(async () => undefined);
    const sessionListeners = new Set<(state: SessionState) => void>();
    const store = {
      subscribe: (listener: (state: SessionState) => void) => {
        sessionListeners.add(listener);
        return () => sessionListeners.delete(listener);
      },
    };
    const appState: { listener: ((status: AppStateStatus) => void) | null } = { listener: null };
    const remove = jest.fn();
    // The browser's `online` event (the Jest environment has no DOM events).
    const events = new EventTarget();
    const target = window as unknown as Record<string, unknown>;
    const previous = { add: target.addEventListener, remove: target.removeEventListener };
    target.addEventListener = events.addEventListener.bind(events);
    target.removeEventListener = events.removeEventListener.bind(events);
    const addListener = jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      appState.listener = listener as (status: AppStateStatus) => void;
      return { remove } as unknown as ReturnType<typeof AppState.addEventListener>;
    });

    try {
      const stop = startPendingLogoutRetries({ queue: { flush }, store });
      expect(flush).toHaveBeenCalledTimes(1);

      sessionListeners.forEach((listener) => listener({ status: 'signedOut', userId: null, role: null }));
      expect(flush).toHaveBeenCalledTimes(1);
      sessionListeners.forEach((listener) => listener({ status: 'signedIn', userId: 'u1', role: 'customer' }));
      expect(flush).toHaveBeenCalledTimes(2);

      appState.listener?.('background');
      appState.listener?.('active');
      expect(flush).toHaveBeenCalledTimes(3);

      events.dispatchEvent(new Event('online'));
      expect(flush).toHaveBeenCalledTimes(4);

      stop();
      expect(remove).toHaveBeenCalled();
      expect(sessionListeners.size).toBe(0);
      events.dispatchEvent(new Event('online'));
      expect(flush).toHaveBeenCalledTimes(4);
    } finally {
      addListener.mockRestore();
      target.addEventListener = previous.add;
      target.removeEventListener = previous.remove;
    }
  });
});
