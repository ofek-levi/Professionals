/**
 * The email a user already typed, carried to the next auth screen: "Sign in with this email" after
 * the sign-up found an existing account (→ sign in), "Forgot password?" (→ reset). Kept in memory
 * only – never in the URL, where it would end up in the browser history.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';

let hint: string | null = null;

export const authEmailHint = {
  /** Hands `email` to the next auth screen that takes it (blank values are ignored). */
  set(email: string): void {
    const trimmed = email.trim();
    hint = trimmed ? trimmed : null;
  },
  /** Returns the pending email once (then forgets it), or `null`. */
  take(): string | null {
    const value = hint;
    hint = null;
    return value;
  },
};

/**
 * Takes a pending email hint whenever the screen gains focus – also when it was already in the
 * stack (e.g. the sign-in screen the sign-up flow returns to) – and passes it to `apply`.
 */
export function useAuthEmailHint(apply: (email: string) => void): void {
  const applyRef = useRef(apply);
  useEffect(() => {
    applyRef.current = apply;
  });
  useFocusEffect(
    useCallback(() => {
      const email = authEmailHint.take();
      if (email) applyRef.current(email);
    }, []),
  );
}
