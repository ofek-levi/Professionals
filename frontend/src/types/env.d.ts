/// <reference types="expo/types" />

// Environment variables inlined by Expo at build time (documented in .env.example; read in
// src/config/env.ts, src/services/auth/google-client-ids.ts and src/constants/map-tiles.ts).
declare namespace NodeJS {
  interface ProcessEnv {
    /** `development` (default) | `staging` | `production`. */
    EXPO_PUBLIC_APP_ENV?: string;
    /** API root ending in `/v1`; required (https) for staging and production. */
    EXPO_PUBLIC_API_BASE_URL?: string;
    /** EAS project id for Expo push tokens. Unset → push notifications are off. */
    EXPO_PUBLIC_EAS_PROJECT_ID?: string;
    /** Google OAuth client ids. Unset for the running platform → no "Continue with Google". */
    EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?: string;
    EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?: string;
    EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?: string;
    /** Map tile URL template (https, `{z}/{x}/{y}`). Unset → OpenStreetMap (see src/constants/map-tiles.ts). */
    EXPO_PUBLIC_MAP_TILE_URL?: string;
    /** Plain-text credit for a custom tile provider. Unset → "© OpenStreetMap contributors". */
    EXPO_PUBLIC_MAP_TILE_ATTRIBUTION?: string;
  }
}
