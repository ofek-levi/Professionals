import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';

/**
 * Calls `refetch` whenever the screen regains focus (e.g. navigating back to it), skipping the
 * first focus right after mount (the query fetches on mount already).
 *
 * `const query = useJobs('active'); useRefetchOnFocus(query.refetch);`
 */
export function useRefetchOnFocus(refetch: () => unknown, enabled = true): void {
  const isFirstFocus = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      if (enabled) void refetch();
    }, [refetch, enabled]),
  );
}
