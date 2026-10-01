/**
 * Sessions the server ended while the app was signed in: the refresh token was refused (expired,
 * signed out on another device, a password reset, reuse detected). The token manager reports it
 * after signing out locally; the UI tells the user why they are back on the entry screen.
 */
type Listener = () => void;

const listeners = new Set<Listener>();
/** Tasks running with the notice off (`suppressWhile`). */
let suppressed = 0;

export const sessionEnded = {
  notify(): void {
    if (suppressed > 0) return;
    listeners.forEach((listener) => listener());
  },

  /**
   * Runs `task` without notifying: its caller explains the end of the session itself (deleting the
   * account finds it already deleted elsewhere).
   */
  async suppressWhile<T>(task: () => Promise<T>): Promise<T> {
    suppressed += 1;
    try {
      return await task();
    } finally {
      suppressed -= 1;
    }
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
