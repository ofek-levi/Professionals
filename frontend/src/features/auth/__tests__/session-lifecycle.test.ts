import type { SessionState } from '@/services/auth/session-store';

import { startSessionLifecycle } from '../session-lifecycle';

function createFakeStore(initial: SessionState) {
  let state = initial;
  const listeners = new Set<(state: SessionState) => void>();
  return {
    getState: () => state,
    subscribe: (listener: (state: SessionState) => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set(next: SessionState) {
      state = next;
      listeners.forEach((listener) => listener(state));
    },
    listenerCount: () => listeners.size,
  };
}

const signedIn = (userId: string): SessionState => ({
  status: 'signedIn',
  userId,
  role: 'customer',
  accessToken: `demo-token:${userId}`,
});
const signedOut: SessionState = { status: 'signedOut', userId: null, role: null, accessToken: null };
const loading: SessionState = { status: 'loading', userId: null, role: null, accessToken: null };

function setup(initial: SessionState) {
  const store = createFakeStore(initial);
  const queryClient = { clear: jest.fn() };
  const realtime = { connect: jest.fn(), disconnect: jest.fn() };
  const registerDevice = jest.fn(() => Promise.resolve(true));
  const stop = startSessionLifecycle({ store, queryClient, realtime, registerDevice });
  return { store, queryClient, realtime, registerDevice, stop };
}

describe('startSessionLifecycle', () => {
  it('connects a restored session without clearing the (empty) cache', () => {
    const { queryClient, realtime, registerDevice } = setup(signedIn('u1'));
    expect(realtime.connect).toHaveBeenCalledWith('demo-token:u1');
    expect(registerDevice).toHaveBeenCalledTimes(1);
    expect(queryClient.clear).not.toHaveBeenCalled();
  });

  it('ignores the loading state and reacts once the session resolves', () => {
    const { store, realtime } = setup(loading);
    expect(realtime.connect).not.toHaveBeenCalled();
    expect(realtime.disconnect).not.toHaveBeenCalled();
    store.set(signedOut);
    expect(realtime.disconnect).toHaveBeenCalledTimes(1);
  });

  it('clears the cache and reconnects on every identity change', () => {
    const { store, queryClient, realtime, registerDevice } = setup(signedOut);
    store.set(signedIn('u1'));
    expect(queryClient.clear).toHaveBeenCalledTimes(1);
    expect(realtime.connect).toHaveBeenLastCalledWith('demo-token:u1');

    store.set(signedIn('u2'));
    expect(queryClient.clear).toHaveBeenCalledTimes(2);
    expect(realtime.connect).toHaveBeenLastCalledWith('demo-token:u2');
    expect(registerDevice).toHaveBeenCalledTimes(2);

    store.set(signedOut);
    expect(queryClient.clear).toHaveBeenCalledTimes(3);
    expect(realtime.disconnect).toHaveBeenCalledTimes(2);
  });

  it('does nothing when the identity did not change', () => {
    const { store, queryClient, realtime } = setup(signedIn('u1'));
    store.set({ ...signedIn('u1') });
    expect(queryClient.clear).not.toHaveBeenCalled();
    expect(realtime.connect).toHaveBeenCalledTimes(1);
  });

  it('stops listening and disconnects when stopped', () => {
    const { store, stop, realtime, queryClient } = setup(signedIn('u1'));
    stop();
    expect(store.listenerCount()).toBe(0);
    expect(realtime.disconnect).toHaveBeenCalledTimes(1);
    store.set(signedIn('u2'));
    expect(queryClient.clear).not.toHaveBeenCalled();
  });
});
