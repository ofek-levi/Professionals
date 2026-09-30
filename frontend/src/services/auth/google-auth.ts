/**
 * "Continue with Google" – configuration and hook-free helpers.
 *
 * Google sign-in is offered only where it can really work: an OAuth client id is configured for
 * the running platform (`EXPO_PUBLIC_GOOGLE_{WEB,IOS,ANDROID}_CLIENT_ID`) and, on iOS/Android, the
 * app is not running in Expo Go (which can't receive Google's native redirect). Otherwise the
 * button is hidden. The button uses `useRealGoogleIdToken()` (expo-auth-session) to get Google's
 * signed `id_token` for `POST /auth/google` (`useGoogleAuth()`); the backend verifies it.
 * Setup: README → "Google sign-in".
 */
import { isRunningInExpoGo } from 'expo';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { readGoogleClientIds, type GoogleClientIds } from './google-client-ids';

export type { GoogleClientIds } from './google-client-ids';

/** Why Google sign-in is not offered (for developer hints). */
export type GoogleUnavailableReason = 'not_configured' | 'expo_go';

export interface GoogleAuthConfig {
  /** Google sign-in can be offered on this platform. */
  available: boolean;
  clientIds: GoogleClientIds;
  /** Client id used on this platform, `null` when not configured. */
  platformClientId: string | null;
  unavailableReason: GoogleUnavailableReason | null;
}

type RuntimePlatform = 'ios' | 'android' | 'web';

/** Resolves the configuration for a platform (exported for tests; the app uses `googleAuthConfig`). */
export function resolveGoogleAuthConfig(clientIds: GoogleClientIds, platform: RuntimePlatform, inExpoGo: boolean): GoogleAuthConfig {
  const platformClientId =
    platform === 'ios' ? clientIds.iosClientId : platform === 'android' ? clientIds.androidClientId : clientIds.webClientId;
  const unavailableReason: GoogleUnavailableReason | null = !platformClientId
    ? 'not_configured'
    : platform !== 'web' && inExpoGo
      ? 'expo_go'
      : null;
  return { available: unavailableReason === null, clientIds, platformClientId, unavailableReason };
}

function currentPlatform(): RuntimePlatform {
  return Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web';
}

function runningInExpoGo(): boolean {
  try {
    return isRunningInExpoGo();
  } catch {
    return false;
  }
}

export const googleAuthConfig: GoogleAuthConfig = resolveGoogleAuthConfig(readGoogleClientIds(), currentPlatform(), runningInExpoGo());

/**
 * Completes a Google sign-in that redirected back to the web app (closes the popup and hands the
 * result to the opener). Call once at module load of the root layout; a no-op on iOS/Android.
 */
export function completeGoogleAuthRedirect(): void {
  if (Platform.OS !== 'web') return;
  try {
    WebBrowser.maybeCompleteAuthSession();
  } catch {
    // Not an auth redirect.
  }
}
