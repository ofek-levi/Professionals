/**
 * Pull-to-refresh that spins only for the user's own pull. `refreshing` is local: set when the
 * user pulls, cleared when that refresh settles. Binding the spinner to a query's `isRefetching`
 * instead would show it (and push the list down, on iOS/Android) on every background refetch:
 * tab focus, realtime events, invalidations.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export interface PullToRefresh {
  refreshing: boolean;
  onRefresh: () => void;
}

export function usePullToRefresh(refresh: (() => Promise<unknown>) | undefined): PullToRefresh {
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const onRefresh = useCallback(() => {
    if (!refresh) return;
    setRefreshing(true);
    void refresh()
      .catch(() => undefined) // The screen shows its own error state.
      .finally(() => {
        if (mounted.current) setRefreshing(false);
      });
  }, [refresh]);

  return { refreshing, onRefresh };
}
