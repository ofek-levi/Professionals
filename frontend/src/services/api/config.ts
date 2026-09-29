/**
 * Central API configuration.
 *
 * `EXPO_PUBLIC_API_MODE=mock` (default) routes every request to the in-app mock backend.
 * `EXPO_PUBLIC_API_MODE=http` sends real HTTP requests to `EXPO_PUBLIC_API_BASE_URL`.
 * Nothing else in the app needs to change to switch between the two.
 */
export type ApiMode = 'mock' | 'http';

export interface ApiConfig {
  mode: ApiMode;
  baseUrl: string;
  timeoutMs: number;
  mock: {
    /** Simulated network latency range in ms. */
    minLatencyMs: number;
    maxLatencyMs: number;
    /** Probability (0–1) of a simulated transient network failure on each request. */
    failureRate: number;
    /** Persist the mock database between app launches. */
    persist: boolean;
  };
}

const rawMode = process.env.EXPO_PUBLIC_API_MODE;

export const apiConfig: ApiConfig = {
  mode: rawMode === 'http' ? 'http' : 'mock',
  baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://api.example.com/v1',
  timeoutMs: 15_000,
  mock: {
    minLatencyMs: 250,
    maxLatencyMs: 750,
    failureRate: Number(process.env.EXPO_PUBLIC_MOCK_FAILURE_RATE ?? 0) || 0,
    persist: process.env.EXPO_PUBLIC_MOCK_PERSIST !== 'false',
  },
};
