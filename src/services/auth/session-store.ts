/**
 * Framework-agnostic store for the authenticated session (access token + identity).
 * Persisted with AsyncStorage the same way a real JWT/refresh token would be.
 * React components read it through `useSession()` (features/auth).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { User, UserRole } from '@/types/domain';

const STORAGE_KEY = '@professionals/session/v1';

export type SessionStatus = 'loading' | 'signedOut' | 'signedIn';

export interface SessionState {
  status: SessionStatus;
  accessToken: string | null;
  userId: string | null;
  role: UserRole | null;
}

interface PersistedSession {
  accessToken: string;
  userId: string;
  role: UserRole;
}

type Listener = (state: SessionState) => void;

const SIGNED_OUT: SessionState = { status: 'signedOut', accessToken: null, userId: null, role: null };

let state: SessionState = { status: 'loading', accessToken: null, userId: null, role: null };
const listeners = new Set<Listener>();
let hydratePromise: Promise<SessionState> | null = null;

function setState(next: SessionState) {
  state = next;
  listeners.forEach((listener) => listener(state));
}

function isPersistedSession(value: unknown): value is PersistedSession {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PersistedSession>;
  return (
    typeof candidate.accessToken === 'string' &&
    typeof candidate.userId === 'string' &&
    (candidate.role === 'customer' || candidate.role === 'professional')
  );
}

export const sessionStore = {
  getState(): SessionState {
    return state;
  },

  getAccessToken(): string | null {
    return state.accessToken;
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /** Restores a persisted session once per app launch. */
  hydrate(): Promise<SessionState> {
    if (!hydratePromise) {
      hydratePromise = (async () => {
        try {
          const raw = await AsyncStorage.getItem(STORAGE_KEY);
          const parsed: unknown = raw ? JSON.parse(raw) : null;
          if (isPersistedSession(parsed)) {
            setState({ status: 'signedIn', ...parsed });
          } else {
            setState(SIGNED_OUT);
          }
        } catch {
          setState(SIGNED_OUT);
        }
        return state;
      })();
    }
    return hydratePromise;
  },

  async signIn(accessToken: string, user: Pick<User, 'id' | 'role'>): Promise<void> {
    const persisted: PersistedSession = { accessToken, userId: user.id, role: user.role };
    setState({ status: 'signedIn', ...persisted });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
    } catch {
      // Persistence failure only affects the next launch.
    }
  },

  async signOut(): Promise<void> {
    setState(SIGNED_OUT);
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore.
    }
  },

  /** Called by the API client on HTTP 401. */
  handleUnauthorized(): void {
    if (state.status === 'signedIn') void sessionStore.signOut();
  },
};
