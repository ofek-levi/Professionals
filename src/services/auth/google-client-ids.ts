/**
 * The Google OAuth client ids of the app (web, iOS, Android), from `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID`.
 * Used by the app to start Google sign-in (`google-auth.ts`) and by the in-app mock backend as the
 * accepted `aud` of Google id tokens. Dependency-free.
 */

export interface GoogleClientIds {
  webClientId: string | null;
  iosClientId: string | null;
  androidClientId: string | null;
}

const clean = (value: string | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

/** Reads the configured client ids (each `null` when not set). */
export function readGoogleClientIds(): GoogleClientIds {
  return {
    // Must be referenced literally so Expo inlines them at build time.
    webClientId: clean(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID),
    iosClientId: clean(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID),
    androidClientId: clean(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID),
  };
}

/** Every configured client id: the audiences a Google id token for this app may carry. */
export function googleAudiences(clientIds: GoogleClientIds = readGoogleClientIds()): string[] {
  return [clientIds.webClientId, clientIds.iosClientId, clientIds.androidClientId].filter((id): id is string => id !== null);
}
