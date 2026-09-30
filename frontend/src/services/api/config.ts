/**
 * API connection settings. The base URL comes from `EXPO_PUBLIC_API_BASE_URL` (src/config/env.ts);
 * every request goes to that backend over HTTP, realtime events over its WebSocket.
 */
import { env } from '@/config/env';

export interface ApiConfig {
  baseUrl: string;
  realtimeUrl: string;
  /** Default time limit of one request. */
  timeoutMs: number;
}

export const apiConfig: ApiConfig = {
  baseUrl: env.apiBaseUrl,
  realtimeUrl: env.realtimeUrl,
  timeoutMs: 15_000,
};
