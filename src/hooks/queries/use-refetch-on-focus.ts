import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';

/**
 * Calls `refetch` whenever the screen regains focus (e.g. navigating back to it), skipping the
 * first focus right after mount (the query fetches on mount already).
 *
 * Only focus changes trigger a refetch: the latest `refetch` / `enabled` are read when the screen
 * gains focus, so a new function identity on a re-render (a derived callback, a React Compiler
 * re-memoization) never re-runs the focus effect.
 *
 * `const query = useJobs('active'); useRefetchOnFocus(query.refetch);`
 */
export function useRefetchOnFocus(refetch: () => unknown, enabled = true): void {
  const isFirstFocus = useRef(true);
  const latest = useRef({ refetch, enabled });
  useEffect(() => {
    latest.current = { refetch, enabled };
  });

  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      if (latest.current.enabled) void latest.current.refetch();
    }, []),
  );
}
