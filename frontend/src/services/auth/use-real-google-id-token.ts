/**
 * Google sign-in (expo-auth-session) returning Google's `id_token`. Only active when
 * `googleAuthConfig.available`; otherwise the hook is an inert stand-in (the Google request hook
 * would throw without a client id), so the button can call it unconditionally.
 */
import * as Google from 'expo-auth-session/providers/google';
import type { AuthSessionResult } from 'expo-auth-session';
import { useCallback, useEffect, useRef } from 'react';

import { googleAuthConfig } from './google-auth';

export interface RealGoogleIdToken {
  /** Google sign-in is configured for this platform (otherwise the button is hidden). */
  isAvailable: boolean;
  /** The auth request is loaded and `prompt()` can be called. */
  isReady: boolean;
  /**
   * Opens Google's sign-in. Resolves with the id token, or `null` when the user closed it.
   * Rejects when Google reports an error.
   */
  prompt: () => Promise<string | null>;
}

interface PendingPrompt {
  resolve: (token: string | null) => void;
  reject: (error: Error) => void;
}

function idTokenOf(result: AuthSessionResult): string | null {
  if (result.type !== 'success') return null;
  return result.params.id_token || result.authentication?.idToken || null;
}

function useConfiguredGoogleIdToken(): RealGoogleIdToken {
  const { webClientId, iosClientId, androidClientId } = googleAuthConfig.clientIds;
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: webClientId ?? undefined,
    iosClientId: iosClientId ?? undefined,
    androidClientId: androidClientId ?? undefined,
    selectAccount: true,
  });
  const pending = useRef<PendingPrompt | null>(null);

  // On iOS/Android the id token arrives after the automatic code exchange (in `response`).
  useEffect(() => {
    const waiter = pending.current;
    if (!waiter || !response) return;
    if (response.type === 'success') {
      const token = idTokenOf(response);
      if (!token) return; // Code exchange still running.
      pending.current = null;
      waiter.resolve(token);
    } else if (response.type === 'error') {
      pending.current = null;
      waiter.reject(response.error ?? new Error('Google sign-in failed'));
    } else {
      pending.current = null;
      waiter.resolve(null);
    }
  }, [response]);

  const prompt = useCallback(
    () =>
      new Promise<string | null>((resolve, reject) => {
        pending.current?.resolve(null);
        const waiter: PendingPrompt = { resolve, reject };
        pending.current = waiter;
        promptAsync()
          .then((result) => {
            if (pending.current !== waiter) return;
            if (result.type === 'success') {
              // Web returns the id token directly; native waits for the exchange (effect above).
              const token = idTokenOf(result);
              if (token) {
                pending.current = null;
                resolve(token);
              }
            } else if (result.type === 'error') {
              pending.current = null;
              reject(result.error ?? new Error('Google sign-in failed'));
            } else {
              pending.current = null;
              resolve(null);
            }
          })
          .catch((error: unknown) => {
            if (pending.current === waiter) pending.current = null;
            reject(error instanceof Error ? error : new Error('Google sign-in failed'));
          });
      }),
    [promptAsync],
  );

  return { isAvailable: true, isReady: request !== null, prompt };
}

const resolveNull = () => Promise.resolve<string | null>(null);

function useUnavailableGoogleIdToken(): RealGoogleIdToken {
  return { isAvailable: false, isReady: false, prompt: resolveNull };
}

/**
 * Google sign-in when configured; an inert stand-in otherwise. The implementation is chosen once
 * at module load (the configuration never changes at runtime), so hook order is stable.
 */
export const useRealGoogleIdToken: () => RealGoogleIdToken = googleAuthConfig.available
  ? useConfiguredGoogleIdToken
  : useUnavailableGoogleIdToken;
