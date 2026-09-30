/**
 * The signed-in session: identity (user id + role, what React renders from) and its tokens.
 *
 * This is the only module that knows where the session is kept:
 * - iOS/Android: `expo-secure-store` (Keychain / Android Keystore), readable after the first unlock
 *   and never included in backups or restored to another device;
 * - web: `localStorage`. Any script running on the page could read it, which is the documented
 *   trade-off of a pure SPA with bearer tokens (the API does not use cookies). The refresh token
 *   rotates on every use and a stolen one is detected on reuse (the server revokes the session).
 *   Other tabs follow along through the `storage` event (sign-out, refreshed tokens).
 *
 * React components read the identity through `useSession()` (features/auth). Token refreshes change
 * only the tokens: they never notify identity listeners.
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { AuthSession, SessionTokens } from '@/types/api';
import type { UserRole } from '@/types/domain';

/** SecureStore keys may only contain letters, digits, `.`, `-` and `_`. */
const STORAGE_KEY = 'professionals.session.v2';
const SECURE_OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

export type SessionStatus = 'loading' | 'signedOut' | 'signedIn';

export interface SessionState {
  status: SessionStatus;
  userId: string | null;
  role: UserRole | null;
}

interface PersistedSession extends SessionTokens {
  userId: string;
  role: UserRole;
}

type Listener = (state: SessionState) => void;

const SIGNED_OUT: SessionState = { status: 'signedOut', userId: null, role: null };

let state: SessionState = { status: 'loading', userId: null, role: null };
let tokens: SessionTokens | null = null;
const listeners = new Set<Listener>();
let hydratePromise: Promise<SessionState> | null = null;

// ─────────────────────────────── Storage ───────────────────────────────

const isWeb = Platform.OS === 'web';

function webStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null; // Storage disabled (privacy mode).
  }
}

async function readRaw(): Promise<string | null> {
  if (isWeb) return webStorage()?.getItem(STORAGE_KEY) ?? null;
  return SecureStore.getItemAsync(STORAGE_KEY, SECURE_OPTIONS);
}

async function writeRaw(value: string | null): Promise<void> {
  if (isWeb) {
    const storage = webStorage();
    if (value === null) storage?.removeItem(STORAGE_KEY);
    else storage?.setItem(STORAGE_KEY, value);
    return;
  }
  if (value === null) await SecureStore.deleteItemAsync(STORAGE_KEY, SECURE_OPTIONS);
  else await SecureStore.setItemAsync(STORAGE_KEY, value, SECURE_OPTIONS);
}

function parsePersisted(raw: string | null): PersistedSession | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<PersistedSession> | null;
    if (
      value &&
      typeof value.accessToken === 'string' &&
      typeof value.accessTokenExpiresAt === 'string' &&
      typeof value.refreshToken === 'string' &&
      typeof value.userId === 'string' &&
      (value.role === 'customer' || value.role === 'professional')
    ) {
      const { accessToken, accessTokenExpiresAt, refreshToken, userId, role } = value;
      return { accessToken, accessTokenExpiresAt, refreshToken, userId, role };
    }
  } catch {
    // Corrupt entry: treated as signed out.
  }
  return null;
}

async function persist(session: PersistedSession | null): Promise<void> {
  try {
    await writeRaw(session ? JSON.stringify(session) : null);
  } catch (error) {
    // Only the next launch is affected (it starts signed out).
    if (__DEV__) console.warn('[session] could not persist the session', error);
  }
}

// ─────────────────────────────── State ───────────────────────────────

function setState(next: SessionState) {
  state = next;
  listeners.forEach((listener) => listener(state));
}

function currentPersisted(): PersistedSession | null {
  return tokens && state.userId && state.role ? { ...tokens, userId: state.userId, role: state.role } : null;
}

function adopt(session: PersistedSession | null) {
  tokens = session
    ? { accessToken: session.accessToken, accessTokenExpiresAt: session.accessTokenExpiresAt, refreshToken: session.refreshToken }
    : null;
  const next: SessionState = session ? { status: 'signedIn', userId: session.userId, role: session.role } : SIGNED_OUT;
  if (next.status !== state.status || next.userId !== state.userId || next.role !== state.role) setState(next);
}

/** Web: another tab signed in or out, or refreshed the tokens. */
function listenToOtherTabs() {
  if (!isWeb || typeof window === 'undefined') return;
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    adopt(parsePersisted(webStorage()?.getItem(STORAGE_KEY) ?? null));
  });
}

export const sessionStore = {
  getState(): SessionState {
    return state;
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  /** The current tokens (`null` when signed out). */
  getTokens(): SessionTokens | null {
    return tokens;
  },

  getAccessToken(): string | null {
    return tokens?.accessToken ?? null;
  },

  /** Restores the persisted session once per app launch. */
  hydrate(): Promise<SessionState> {
    hydratePromise ??= (async () => {
      let persisted: PersistedSession | null = null;
      try {
        persisted = parsePersisted(await readRaw());
      } catch {
        persisted = null;
      }
      adopt(persisted);
      listenToOtherTabs();
      return state;
    })();
    return hydratePromise;
  },

  /**
   * The tokens as persisted right now: another tab (web) may have refreshed them since this one
   * read them. Adopts a newer copy of the same session; `null` when signed out.
   */
  async reloadTokens(): Promise<SessionTokens | null> {
    if (!isWeb) return tokens;
    const persisted = parsePersisted(await readRaw().catch(() => null));
    if (persisted && persisted.userId === state.userId) {
      tokens = { accessToken: persisted.accessToken, accessTokenExpiresAt: persisted.accessTokenExpiresAt, refreshToken: persisted.refreshToken };
    }
    return tokens;
  },

  /** Starts `session` (sign-in / sign-up / Google). */
  async signIn(session: AuthSession): Promise<void> {
    const { accessToken, accessTokenExpiresAt, refreshToken, user } = session;
    tokens = { accessToken, accessTokenExpiresAt, refreshToken };
    setState({ status: 'signedIn', userId: user.id, role: user.role });
    await persist(currentPersisted());
  },

  /** Stores refreshed tokens of the current session (identity listeners are not notified). */
  async updateTokens(next: SessionTokens): Promise<void> {
    if (state.status !== 'signedIn') return;
    tokens = { accessToken: next.accessToken, accessTokenExpiresAt: next.accessTokenExpiresAt, refreshToken: next.refreshToken };
    await persist(currentPersisted());
  },

  /** Ends the session locally (the server logout is `useAuthActions().signOut`). */
  async signOut(): Promise<void> {
    tokens = null;
    if (state.status !== 'signedOut') setState(SIGNED_OUT);
    await persist(null);
  },
};

export type SessionStore = typeof sessionStore;
