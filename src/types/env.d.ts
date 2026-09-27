/// <reference types="expo/types" />

// Environment variables inlined by Expo at build time (see src/services/api/config.ts).
declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_API_MODE?: 'mock' | 'http';
    EXPO_PUBLIC_API_BASE_URL?: string;
    EXPO_PUBLIC_MOCK_FAILURE_RATE?: string;
    EXPO_PUBLIC_MOCK_PERSIST?: string;
    GOOGLE_MAPS_ANDROID_API_KEY?: string;
  }
}
