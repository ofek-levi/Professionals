import { useCallback, useEffect, useRef, useState } from 'react';

export interface SingleFlight {
  /**
   * Runs `action` unless one is already running (then the call is ignored). A double tap on
   * "Create account" would otherwise send the request twice: the button only turns into a loading
   * state once the mutation is pending, a few awaits (validation) after the first tap.
   */
  run: (action: () => Promise<void>) => Promise<void>;
  /** An action is running (e.g. to show the button's loading state during validation). */
  running: boolean;
  /**
   * Whether the screen is still mounted. A result that arrives after it went away (e.g. the session
   * started and the protected routes replaced it) has nobody to show it to.
   */
  isMounted: () => boolean;
}

/** One submit at a time for a form screen (auth screens: sign in, sign up, reset, Google). */
export function useSingleFlight(): SingleFlight {
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (action: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRunning(true);
    try {
      await action();
    } finally {
      inFlight.current = false;
      if (mounted.current) setRunning(false);
    }
  }, []);

  const isMounted = useCallback(() => mounted.current, []);

  return { run, running, isMounted };
}
