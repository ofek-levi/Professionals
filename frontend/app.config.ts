import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Dynamic config on top of app.json, only for values that come from the build environment:
 * - `extra.eas.projectId` from `EXPO_PUBLIC_EAS_PROJECT_ID` (Expo push tokens are issued for it);
 * - `android.googleServicesFile` when `GOOGLE_SERVICES_FILE` points to an existing file (Firebase
 *   Cloud Messaging, required for push on Android).
 * Everything else lives in app.json.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim();
  const googleServicesFile = process.env.GOOGLE_SERVICES_FILE?.trim();
  const hasGoogleServices = Boolean(googleServicesFile && existsSync(resolve(__dirname, googleServicesFile)));
  if (googleServicesFile && !hasGoogleServices) {
    console.warn(`GOOGLE_SERVICES_FILE does not exist: ${googleServicesFile} (Android push stays off).`);
  }
  const base = config as ExpoConfig;
  return {
    ...base,
    ...(projectId ? { extra: { ...base.extra, eas: { ...base.extra?.eas, projectId } } } : {}),
    ...(hasGoogleServices ? { android: { ...base.android, googleServicesFile } } : {}),
  };
};
