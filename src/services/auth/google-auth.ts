/**
 * "Continue with Google" – configuration and hook-free helpers.
 *
 * Two modes, fixed for the lifetime of the app (env vars are inlined at build time):
 * - `google`: an OAuth client id is configured for the current platform (and, on iOS/Android, the
 *   app is not running in Expo Go, which can't receive Google's native redirect). The button uses
 *   `useRealGoogleIdToken()` (expo-auth-session) and gets Google's signed `id_token`.
 * - `simulated`: no client id (demo). The button opens our own "Continue with Google (demo)" sheet
 *   with `SIMULATED_GOOGLE_ACCOUNTS` / "Use another account" and builds a mock id token with
 *   `buildMockGoogleIdToken()`. The mock backend accepts both kinds of token.
 *
 * Either way the result is an id token for `POST /auth/google` (`useGoogleAuth()`).
 * Setup: README → "Google sign-in" and docs/BACKEND_INTEGRATION.md.
 */
import { isRunningInExpoGo } from 'expo';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { readGoogleClientIds, type GoogleClientIds } from './google-client-ids';
import type { GoogleIdentity } from './google-id-token';

export type { GoogleClientIds } from './google-client-ids';

export {
  buildMockGoogleIdToken,
  isMockGoogleIdToken,
  parseMockGoogleIdToken,
  type GoogleIdentity,
  type GoogleIdTokenClaims,
} from './google-id-token';

export type GoogleAuthMode = 'google' | 'simulated';

/** Why real Google sign-in is not used (for developer hints). */
export type GoogleSimulationReason = 'not_configured' | 'expo_go';

export interface GoogleAuthConfig {
  mode: GoogleAuthMode;
  clientIds: GoogleClientIds;
  /** Client id used on this platform, `null` when not configured. */
  platformClientId: string | null;
  /** Set in `simulated` mode. */
  simulationReason: GoogleSimulationReason | null;
}

type RuntimePlatform = 'ios' | 'android' | 'web';

/** Resolves the mode for a platform (exported for tests; the app uses `googleAuthConfig`). */
export function resolveGoogleAuthConfig(
  clientIds: GoogleClientIds,
  platform: RuntimePlatform,
  inExpoGo: boolean,
): GoogleAuthConfig {
  const platformClientId =
    platform === 'ios' ? clientIds.iosClientId : platform === 'android' ? clientIds.androidClientId : clientIds.webClientId;
  const simulationReason: GoogleSimulationReason | null = !platformClientId
    ? 'not_configured'
    : platform !== 'web' && inExpoGo
      ? 'expo_go'
      : null;
  return { mode: simulationReason ? 'simulated' : 'google', clientIds, platformClientId, simulationReason };
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

export function isRealGoogleAuthAvailable(): boolean {
  return googleAuthConfig.mode === 'google';
}

/** A sample identity of the simulated Google sheet. */
export interface SimulatedGoogleAccount extends GoogleIdentity {
  id: string;
  avatarUrl: string | null;
  /**
   * `new`: a sample new user (no account in the seeded data → continues the sign-up flow).
   * `existing`: the email of a demo account → signs straight in. Only a label: the backend decides
   * (e.g. the sample user has an account once they signed up in this browser).
   */
  kind: 'new' | 'existing';
}

/**
 * Sample identities for the simulated sheet: one brand-new user and the emails of two demo
 * accounts (a customer and a professional) to try signing in to an existing account.
 */
export const SIMULATED_GOOGLE_ACCOUNTS: readonly SimulatedGoogleAccount[] = [
  {
    id: 'maya-katz',
    firstName: 'Maya',
    lastName: 'Katz',
    email: 'maya.katz@gmail.com',
    avatarUrl: null,
    kind: 'new',
  },
  {
    id: 'noa-levi',
    firstName: 'Noa',
    lastName: 'Levi',
    email: 'noa.levi@example.com',
    avatarUrl: 'https://randomuser.me/api/portraits/women/65.jpg',
    kind: 'existing',
  },
  {
    id: 'avi-mizrahi',
    firstName: 'Avi',
    lastName: 'Mizrahi',
    email: 'avi@aquafix.example.com',
    avatarUrl: 'https://randomuser.me/api/portraits/men/32.jpg',
    kind: 'existing',
  },
];

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
