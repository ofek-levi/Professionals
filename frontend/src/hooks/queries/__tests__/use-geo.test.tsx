/**
 * Geocoding answers are localized by the server (`Accept-Language`), so a cached Hebrew address
 * must not come back after switching to English (it would be saved as the English address).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { i18n, initI18n } from '@/i18n';
import { apiClient } from '@/services/api';
import { createTestEnvironment, type TestEnvironment } from '@/test-utils/mock-backend/testing/test-server';

import { queryKeys } from '../query-keys';
import { useReverseGeocode } from '../use-geo';

let env: TestEnvironment;
const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

beforeAll(async () => {
  await initI18n('he');
  env = createTestEnvironment();
  apiClient.setTransport(env.transport);
});

afterAll(async () => {
  await i18n.changeLanguage('en');
});

describe('geo query keys', () => {
  it('keep one cache entry per language (and per search limit)', () => {
    expect(queryKeys.geo.search('Dizengoff', 6, 'he')).not.toEqual(queryKeys.geo.search('Dizengoff', 6, 'en'));
    expect(queryKeys.geo.search('Dizengoff', 6, 'en')).not.toEqual(queryKeys.geo.search('Dizengoff', 3, 'en'));
    expect(queryKeys.geo.reverse(32.08, 34.78, 'he')).not.toEqual(queryKeys.geo.reverse(32.08, 34.78, 'en'));
  });

  it('asks the server again after a language switch instead of reusing the other language', async () => {
    const point = { latitude: 32.0853, longitude: 34.7818 };
    const { result } = await renderHook(() => useReverseGeocode(point), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const reverse = () => env.log.to('/geo/reverse', 'GET');
    expect(reverse()).toHaveLength(1);
    expect(reverse()[0].headers['Accept-Language']).toBe('he');

    await act(async () => {
      await i18n.changeLanguage('en');
    });
    await waitFor(() => expect(reverse()).toHaveLength(2));
    expect(reverse()[1].headers['Accept-Language']).toBe('en');
  });
});
