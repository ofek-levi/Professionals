/**
 * The pull-to-refresh spinner belongs to the user's pull: it shows from the pull until that
 * refresh settles (also when it fails), and never for refetches the user did not ask for.
 */
import { act, renderHook } from '@testing-library/react-native';

import { usePullToRefresh } from '../use-pull-to-refresh';

describe('usePullToRefresh', () => {
  it('spins from the pull until the refresh settles', async () => {
    let finish: () => void = () => undefined;
    const refresh = jest.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const { result } = await renderHook(() => usePullToRefresh(refresh));
    expect(result.current.refreshing).toBe(false);

    await act(async () => result.current.onRefresh());
    expect(result.current.refreshing).toBe(true);
    expect(refresh).toHaveBeenCalledTimes(1);

    await act(async () => finish());
    expect(result.current.refreshing).toBe(false);
  });

  it('stops spinning when the refresh fails (the screen shows the error)', async () => {
    const { result } = await renderHook(() => usePullToRefresh(() => Promise.reject(new Error('offline'))));
    await act(async () => result.current.onRefresh());
    expect(result.current.refreshing).toBe(false);
  });

  it('does nothing without a refresh function', async () => {
    const { result } = await renderHook(() => usePullToRefresh(undefined));
    await act(async () => result.current.onRefresh());
    expect(result.current.refreshing).toBe(false);
  });
});
