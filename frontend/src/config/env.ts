/**
 * Build-time configuration from the `EXPO_PUBLIC_*` variables (see `frontend/.env.example`). Expo
 * inlines them when the bundle is built, so each one is referenced literally below and the result
 * never changes while the app runs.
 *
 * - `EXPO_PUBLIC_APP_ENV`: `development` (default) | `staging` | `production`.
 * - `EXPO_PUBLIC_API_BASE_URL`: the API root, ending in `/v1`. Development defaults to
 *   `http://localhost:4000/v1` (Android emulator: `http://10.0.2.2:4000/v1`; a phone: the computer's
 *   LAN address); staging and production must set an explicit `https://` URL.
 * - `EXPO_PUBLIC_EAS_PROJECT_ID`: the EAS project id push tokens are issued for (optional; without
 *   it push notifications are off).
 */
export const APP_ENVS = ['development', 'staging', 'production'] as const;
export type AppEnv = (typeof APP_ENVS)[number];

export const DEVELOPMENT_API_BASE_URL = 'http://localhost:4000/v1';

export interface EnvConfig {
  appEnv: AppEnv;
  /** API root without a trailing slash, e.g. `https://api.example.com/v1`. */
  apiBaseUrl: string;
  /** WebSocket URL of the realtime channel (`ws(s)://…/v1/realtime`). */
  realtimeUrl: string;
  /** EAS project id for Expo push tokens, `null` when not configured. */
  easProjectId: string | null;
}

interface RawEnv {
  appEnv?: string;
  apiBaseUrl?: string;
  easProjectId?: string;
}

/** Thrown at startup when a deployed build is misconfigured (fail fast, clear message). */
export class EnvConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvConfigError';
  }
}

const clean = (value: string | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

function parseAppEnv(value: string | null): AppEnv {
  if (value === null) return 'development';
  if ((APP_ENVS as readonly string[]).includes(value)) return value as AppEnv;
  throw new EnvConfigError(`EXPO_PUBLIC_APP_ENV must be one of ${APP_ENVS.join(', ')} (got "${value}").`);
}

function parseBaseUrl(value: string | null, appEnv: AppEnv): string {
  if (value === null) {
    if (appEnv === 'development') return DEVELOPMENT_API_BASE_URL;
    throw new EnvConfigError(`EXPO_PUBLIC_API_BASE_URL is required for ${appEnv} builds (an https URL ending in /v1).`);
  }
  const url = value.replace(/\/+$/, '');
  const protocol = /^(https?):\/\/[^\s/?#]+/i.exec(url)?.[1]?.toLowerCase();
  if (!protocol) throw new EnvConfigError(`EXPO_PUBLIC_API_BASE_URL is not an http(s) URL: "${value}".`);
  if (appEnv !== 'development' && protocol !== 'https') {
    throw new EnvConfigError(`EXPO_PUBLIC_API_BASE_URL must use https for ${appEnv} builds (got "${value}").`);
  }
  if (!url.endsWith('/v1') && __DEV__) console.warn(`[env] EXPO_PUBLIC_API_BASE_URL usually ends in /v1 (got "${value}").`);
  return url;
}

/** `http(s)://host/v1` → `ws(s)://host/v1/realtime`. */
export function toRealtimeUrl(apiBaseUrl: string): string {
  return `${apiBaseUrl.replace(/^http/i, 'ws')}/realtime`;
}

/** Validates the raw variables (exported for tests; the app uses `env`). */
export function resolveEnv(raw: RawEnv): EnvConfig {
  const appEnv = parseAppEnv(clean(raw.appEnv));
  const apiBaseUrl = parseBaseUrl(clean(raw.apiBaseUrl), appEnv);
  return { appEnv, apiBaseUrl, realtimeUrl: toRealtimeUrl(apiBaseUrl), easProjectId: clean(raw.easProjectId) };
}

export const env: EnvConfig = resolveEnv({
  appEnv: process.env.EXPO_PUBLIC_APP_ENV,
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
  easProjectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
});
