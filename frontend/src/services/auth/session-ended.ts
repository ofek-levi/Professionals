/**
 * Sessions the server ended while the app was signed in: the refresh token was refused (expired,
 * signed out on another device, a password reset, reuse detected). The token manager reports it
 * after signing out locally; the UI tells the user why they are back on the entry screen.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

export const sessionEnded = {
  notify(): void {
    listeners.forEach((listener) => listener());
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
