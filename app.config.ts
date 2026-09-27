import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Dynamic config layered on top of app.json.
 *
 * - `GOOGLE_MAPS_ANDROID_API_KEY` is required for Android development/production builds
 *   (Expo Go ships with its own key). iOS uses Apple Maps and needs no key.
 * - `EXPO_PUBLIC_API_MODE` / `EXPO_PUBLIC_API_BASE_URL` select the API transport at runtime
 *   (see src/services/api/config.ts).
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  plugins: [
    ...(config.plugins ?? []),
    [
      'react-native-maps',
      {
        androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY,
      },
    ],
  ],
});
