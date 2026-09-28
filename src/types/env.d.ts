/// <reference types="expo/types" />

// Environment variables inlined by Expo at build time (see src/services/api/config.ts).
declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_API_MODE?: 'mock' | 'http';
    EXPO_PUBLIC_API_BASE_URL?: string;
    EXPO_PUBLIC_MOCK_FAILURE_RATE?: string;
    EXPO_PUBLIC_MOCK_PERSIST?: string;
    /** Google OAuth client ids (see README → Google sign-in). Unset → simulated Google sign-in. */
    EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?: string;
    EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?: string;
    EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?: string;
    /** Map tile URL template (https, `{z}/{x}/{y}`). Unset → OpenStreetMap (see src/constants/map-tiles.ts). */
    EXPO_PUBLIC_MAP_TILE_URL?: string;
    /** Plain-text credit for a custom tile provider. Unset → "© OpenStreetMap contributors". */
    EXPO_PUBLIC_MAP_TILE_ATTRIBUTION?: string;
  }
}
