/**
 * The single entry point to server data. Screens and components never call this directly –
 * they use the React Query hooks in `src/hooks`, which call `api.*`.
 *
 * Switching to a real backend: set `EXPO_PUBLIC_API_MODE=http` and `EXPO_PUBLIC_API_BASE_URL`.
 */
import i18n from 'i18next';

import { getMockServer } from '@/mocks/server';
import { DEMO_ACCOUNT_PASSWORD, DEMO_SIGN_IN_EMAIL } from '@/mocks/server/passwords';
import { createMockTransport, type MockTransportControls } from '@/mocks/transport';
import { sessionStore } from '@/services/auth/session-store';

import { ApiClient } from './client';
import { apiConfig } from './config';
import { createHttpTransport } from './http-transport';
import { createMarketplaceApi } from './marketplace-api';
import type { Transport } from './transport';

let mockControls: MockTransportControls | null = null;

function createTransport(): Transport {
  if (apiConfig.mode === 'http') {
    return createHttpTransport({ baseUrl: apiConfig.baseUrl, timeoutMs: apiConfig.timeoutMs });
  }
  const { transport, controls } = createMockTransport(getMockServer(), {
    minLatencyMs: apiConfig.mock.minLatencyMs,
    maxLatencyMs: apiConfig.mock.maxLatencyMs,
    failureRate: apiConfig.mock.failureRate,
  });
  mockControls = controls;
  return transport;
}

export const apiClient = new ApiClient({
  transport: createTransport(),
  getAccessToken: () => sessionStore.getAccessToken(),
  onUnauthorized: () => sessionStore.handleUnauthorized(),
  getLanguage: () => i18n.language,
});

export const api = createMarketplaceApi(apiClient);

/**
 * Developer / demo controls. Only functional in mock mode; `isAvailable` is false otherwise so
 * the UI can hide the demo tools section.
 */
export const demoTools = {
  isAvailable: apiConfig.mode === 'mock',
  /** A demo account's email and password to try email sign-in with, `null` without the mock backend. */
  demoSignIn: apiConfig.mode === 'mock' ? { email: DEMO_SIGN_IN_EMAIL, password: DEMO_ACCOUNT_PASSWORD } : null,
  async resetDemoData(): Promise<void> {
    if (apiConfig.mode === 'mock') await getMockServer().reset();
  },
  setSimulationEnabled(enabled: boolean): void {
    if (apiConfig.mode === 'mock') getMockServer().setSimulationEnabled(enabled);
  },
  setNetworkFailureRate(rate: number): void {
    mockControls?.setFailureRate(rate);
  },
  getNetworkFailureRate(): number {
    return mockControls?.getFailureRate() ?? 0;
  },
};

export { ApiClient } from './client';
export { ApiError, isApiError, toApiError } from './errors';
export type { MarketplaceApi } from './marketplace-api';
