import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Dynamic config layered on top of app.json.
 *
 * - `EXPO_PUBLIC_API_MODE` / `EXPO_PUBLIC_API_BASE_URL` select the API transport at runtime
 *   (see src/services/api/config.ts).
 * - The map needs no native module or API key: it is Leaflet with OpenStreetMap tiles in a
 *   WebView (`EXPO_PUBLIC_MAP_TILE_URL` optionally points it at another tile server).
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
});
