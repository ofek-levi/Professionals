/**
 * The single entry point to server data. Screens and components never call this directly –
 * they use the React Query hooks in `src/hooks`, which call `api.*`.
 *
 * Every request goes to the backend at `EXPO_PUBLIC_API_BASE_URL` (src/config/env.ts) with the
 * session's access token, refreshed by `sessionTokens` before it expires and after a 401.
 */
import i18n from 'i18next';

import { sessionStore } from '@/services/auth/session-store';
import { createTokenManager } from '@/services/auth/token-manager';

import { ApiClient } from './client';
import { apiConfig } from './config';
import { createHttpTransport } from './http-transport';
import { createMarketplaceApi } from './marketplace-api';

/** Keeps the access token valid (shared by the API client and the realtime connection). */
export const sessionTokens = createTokenManager({
  store: sessionStore,
  refresh: (refreshToken) => api.auth.refresh({ refreshToken }),
});

export const apiClient = new ApiClient({
  transport: createHttpTransport({ baseUrl: apiConfig.baseUrl, timeoutMs: apiConfig.timeoutMs }),
  auth: sessionTokens,
  getLanguage: () => i18n.language,
});

export const api = createMarketplaceApi(apiClient);

export { ApiClient } from './client';
export { ApiError, isApiError, toApiError } from './errors';
export type { MarketplaceApi } from './marketplace-api';
