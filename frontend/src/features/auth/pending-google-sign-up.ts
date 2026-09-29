/**
 * The Google identity of a sign-up in progress ("Continue with Google" for a new user), kept in
 * memory only – never in the URL or storage. `useGoogleAuth()` sets it when the backend answers
 * `registration_required`; the sign-up flow reads it (prefilled, locked email, no password) and it
 * is cleared once an account signs in.
 */
import { useSyncExternalStore } from 'react';

import type { GoogleProfile } from '@/types/api';

export interface PendingGoogleSignUp {
  /** Sent again as `RegisterRequest.googleIdToken`. */
  idToken: string;
  profile: GoogleProfile;
}

let pending: PendingGoogleSignUp | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export const pendingGoogleSignUpStore = {
  get(): PendingGoogleSignUp | null {
    return pending;
  },
  set(next: PendingGoogleSignUp): void {
    pending = next;
    emit();
  },
  clear(): void {
    if (pending === null) return;
    pending = null;
    emit();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

/** The pending Google sign-up (re-renders on change), or `null`. */
export function usePendingGoogleSignUp(): PendingGoogleSignUp | null {
  return useSyncExternalStore(pendingGoogleSignUpStore.subscribe, pendingGoogleSignUpStore.get, pendingGoogleSignUpStore.get);
}
