import { useLocalSearchParams } from 'expo-router';

/**
 * Reads a single route/search param as a string (`undefined` when missing or empty). Expo Router
 * may deliver repeated params as arrays; the first value wins.
 *
 * `const requestId = useRouteParam('requestId');`
 */
export function useRouteParam(name: string): string | undefined {
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const value = params[name];
  const first = Array.isArray(value) ? value[0] : value;
  return first ? first : undefined;
}
