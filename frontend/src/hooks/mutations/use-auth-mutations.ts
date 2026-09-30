/**
 * Account mutations: email sign-in, sign-up, Google sign-in and password reset.
 *
 * A successful sign-in goes through `establishSession()`, which stores the tokens (secure storage),
 * so the session lifecycle clears the cache and connects realtime, and the `Stack.Protected` guards
 * replace the auth screens with the role's home. The calling screen unmounts right after: read
 * the result from `mutateAsync()` (or hook-level callbacks) rather than per-call `mutate` callbacks.
 */
import { useMutation } from '@tanstack/react-query';

import { pendingGoogleSignUpStore } from '@/features/auth/pending-google-sign-up';
import { establishSession } from '@/features/auth/session-provider';
import { api } from '@/services/api';
import type { AuthSession, GoogleAuthResponse, LoginRequest, PasswordResetRequest, RegisterRequest, SuccessResponse } from '@/types/api';

async function signIn(session: AuthSession): Promise<AuthSession> {
  pendingGoogleSignUpStore.clear();
  await establishSession(session);
  return session;
}

/** `POST /auth/login` → signed in. Fails with 401 `INVALID_CREDENTIALS` (show one inline alert). */
export function useLogin() {
  return useMutation<AuthSession, Error, LoginRequest>({
    mutationKey: ['auth', 'login'],
    mutationFn: async (payload) => signIn(await api.auth.login(payload)),
  });
}

/**
 * `POST /auth/register` → account created and signed in. Fails with 409
 * `EMAIL_ALREADY_REGISTERED` or 400 `VALIDATION_ERROR` (map `fieldErrors` with
 * `registerFieldErrorsToForm`).
 */
export function useRegister() {
  return useMutation<AuthSession, Error, RegisterRequest>({
    mutationKey: ['auth', 'register'],
    mutationFn: async (payload) => signIn(await api.auth.register(payload)),
  });
}

/**
 * `POST /auth/google` with Google's id token.
 * - `signed_in`: the session is established (existing account).
 * - `registration_required`: nothing is signed in; the identity is kept as the pending Google
 *   sign-up (`usePendingGoogleSignUp()`) for the sign-up flow.
 * Fails with 401 `INVALID_GOOGLE_TOKEN`.
 */
export function useGoogleAuth() {
  return useMutation<GoogleAuthResponse, Error, string>({
    mutationKey: ['auth', 'google'],
    mutationFn: async (idToken) => {
      const response = await api.auth.signInWithGoogle({ idToken });
      if (response.status === 'signed_in') {
        await signIn(response.session);
      } else {
        pendingGoogleSignUpStore.set({ idToken, profile: response.profile });
      }
      return response;
    },
  });
}

/** `POST /auth/password-reset` – always succeeds for a valid email (never reveals if it exists). */
export function useRequestPasswordReset() {
  return useMutation<SuccessResponse, Error, PasswordResetRequest>({
    mutationKey: ['auth', 'password-reset'],
    mutationFn: (payload) => api.auth.requestPasswordReset(payload),
  });
}
