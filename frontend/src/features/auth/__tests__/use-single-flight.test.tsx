import { act, renderHook } from '@testing-library/react-native';

import { useSingleFlight } from '../use-single-flight';

/** A promise the test settles by hand. */
function deferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('useSingleFlight', () => {
  it('ignores calls while an action is running (a double tap submits once)', async () => {
    const { result } = await renderHook(() => useSingleFlight());
    const gate = deferred();
    const action = jest.fn(() => gate.promise);

    let first: Promise<void> = Promise.resolve();
    await act(async () => {
      first = result.current.run(action);
      // The second tap arrives before the first one finished (e.g. still validating).
      await result.current.run(action);
    });
    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.running).toBe(true);

    await act(async () => {
      gate.resolve();
      await first;
    });
    expect(result.current.running).toBe(false);

    // Once it finished, the next call runs again.
    await act(() => result.current.run(() => Promise.resolve()));
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('frees the flight when the action fails and reports whether the screen is still mounted', async () => {
    const { result, unmount } = await renderHook(() => useSingleFlight());
    await act(async () => {
      await expect(result.current.run(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    });
    const next = jest.fn(() => Promise.resolve());
    await act(() => result.current.run(next));
    expect(next).toHaveBeenCalledTimes(1);

    const { isMounted } = result.current;
    expect(isMounted()).toBe(true);
    await unmount();
    expect(isMounted()).toBe(false);
  });
});
