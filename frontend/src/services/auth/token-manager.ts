/**
 * Keeps the session's access token valid for the API client and the realtime connection:
 * - proactive: a token that expires within `leewayMs` is refreshed before it is used;
 * - reactive: after a 401 the token is refreshed, unless another caller already did.
 * One refresh at a time: every caller that needs a token meanwhile waits for the same one.
 *
 * `POST /auth/refresh` rotates the refresh token; the new pair is stored before it is used. The
 * server answers a replay of the just-replaced token (two tabs, a lost response; while the new
 * one is unused, up to 30 min) with the same new pair, so concurrent refreshes converge. When the refresh token is rejected (expired,
 * revoked, reused) the session is over: the store signs out locally, which clears the cache, closes
 * realtime and shows the entry screen. Network failures keep the session.
 */
import { isApiError } from '@/services/api/errors';
import type { SessionTokens } from '@/types/api';

/** Refresh this long before the access token expires (clock skew, slow networks). */
export const REFRESH_LEEWAY_MS = 60_000;

interface TokenStore {
  getTokens(): SessionTokens | null;
  /** The persisted tokens (web: another tab may have refreshed them). */
  reloadTokens(): Promise<SessionTokens | null>;
  updateTokens(tokens: SessionTokens): Promise<void>;
  signOut(): Promise<void>;
}

export interface TokenManagerDeps {
  store: TokenStore;
  /** `POST /auth/refresh` (anonymous). */
  refresh: (refreshToken: string) => Promise<SessionTokens>;
  /** The server refused the refresh token and the session was signed out locally (tell the user). */
  onSessionRejected?: () => void;
  now?: () => number;
  leewayMs?: number;
}

export interface TokenManager {
  /** A valid access token (refreshed first when it expires soon), or `null` when signed out. */
  getAccessToken(): Promise<string | null>;
  /** After a 401 with `rejectedToken`: the token to retry with, or `null` when the session ended. */
  handleUnauthorized(rejectedToken: string): Promise<string | null>;
}

/** The server refused the refresh token itself: the session cannot be continued. */
function isSessionRejected(error: unknown): boolean {
  return isApiError(error) && (error.status === 401 || error.status === 400);
}

export function createTokenManager({
  store,
  refresh,
  onSessionRejected,
  now = Date.now,
  leewayMs = REFRESH_LEEWAY_MS,
}: TokenManagerDeps): TokenManager {
  let inFlight: Promise<string | null> | null = null;

  const expiresSoon = (tokens: SessionTokens) => {
    const expiresAt = Date.parse(tokens.accessTokenExpiresAt);
    return Number.isNaN(expiresAt) || expiresAt - now() <= leewayMs;
  };

  /** Tokens changed while the refresh ran (signed out, another session, another tab). */
  const replacedSince = (tokens: SessionTokens) => store.getTokens()?.refreshToken !== tokens.refreshToken;

  const runRefresh = async (): Promise<string | null> => {
    const known = store.getTokens();
    const current = await store.reloadTokens();
    if (!current) return null;
    // Another tab refreshed in the meantime: use its tokens instead of spending the old one.
    if (known && current.refreshToken !== known.refreshToken && !expiresSoon(current)) return current.accessToken;

    let next: SessionTokens;
    try {
      next = await refresh(current.refreshToken);
    } catch (error) {
      if (replacedSince(current)) return store.getTokens()?.accessToken ?? null;
      if (isSessionRejected(error)) {
        await store.signOut();
        onSessionRejected?.();
        return null;
      }
      throw error;
    }
    if (replacedSince(current)) return store.getTokens()?.accessToken ?? null;
    await store.updateTokens(next);
    return next.accessToken;
  };

  const refreshOnce = (): Promise<string | null> => {
    inFlight ??= runRefresh().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };

  return {
    async getAccessToken() {
      const tokens = store.getTokens();
      if (!tokens) return null;
      if (!expiresSoon(tokens) && !inFlight) return tokens.accessToken;
      try {
        return await refreshOnce();
      } catch {
        // Offline or the server is down: try the current token, the answer decides.
        return store.getTokens()?.accessToken ?? null;
      }
    },

    async handleUnauthorized(rejectedToken) {
      const tokens = store.getTokens();
      if (!tokens) return null;
      if (tokens.accessToken !== rejectedToken && !inFlight) return tokens.accessToken;
      return refreshOnce();
    },
  };
}
