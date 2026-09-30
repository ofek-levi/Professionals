/**
 * Server sign-outs this device still owes. Signing out ends the session here at once; the server
 * logout (`POST /auth/logout`, which also removes the session's push devices) is sent afterwards.
 * Until the server confirms it, the refresh token stays in this queue, persisted next to the
 * session, and is sent again on the next launch, the next sign-in and whenever the app returns to
 * the foreground. Without it, signing out offline (or with a server too slow to answer) would leave
 * the session alive on the server for 90 days, and the phone would keep receiving the account's
 * push notifications.
 *
 * A token leaves the queue when the server accepts it, or refuses it for good (400/401/403/404:
 * the session is already over). Network errors, timeouts, 429 and 5xx keep it for the next try.
 */
import { isApiError } from '@/services/api/errors';

import { readSecureItem, writeSecureItem } from './secure-storage';

const STORAGE_KEY = 'professionals.pending-logouts.v1';
/** Oldest tokens are dropped beyond this (each sign-out adds one). */
const MAX_PENDING = 10;
/** Refresh tokens expire 90 days after their last use: older entries are dropped unsent. */
const MAX_AGE_MS = 90 * 24 * 60 * 60_000;
const FINAL_STATUSES = new Set([400, 401, 403, 404]);

interface PendingLogout {
  refreshToken: string;
  /** When the sign-out happened (ms). */
  since: number;
}

interface PendingLogoutStorage {
  read(): Promise<string | null>;
  write(value: string | null): Promise<void>;
}

export interface PendingLogoutsDeps {
  /** `POST /auth/logout { refreshToken }` (anonymous). */
  logout: (refreshToken: string) => Promise<unknown>;
  storage?: PendingLogoutStorage;
  now?: () => number;
}

export interface PendingLogouts {
  /** Queues the server logout of `refreshToken` (persisted before it resolves). Never throws. */
  add(refreshToken: string): Promise<void>;
  /** Forgets `refreshToken` without sending it (its session continues). Never throws. */
  discard(refreshToken: string): Promise<void>;
  /** Sends every queued logout once; concurrent calls share the run. Never throws. */
  flush(): Promise<void>;
  /** The queued refresh tokens (oldest first). */
  pending(): Promise<string[]>;
}

const secureStorage: PendingLogoutStorage = {
  read: () => readSecureItem(STORAGE_KEY),
  write: (value) => writeSecureItem(STORAGE_KEY, value),
};

function parse(raw: string | null): PendingLogout[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.filter(
      (item): item is PendingLogout =>
        typeof item === 'object' && item !== null && typeof (item as PendingLogout).refreshToken === 'string' && typeof (item as PendingLogout).since === 'number',
    );
  } catch {
    return [];
  }
}

/** The server will never accept this token: its session is already over. */
function isFinalRefusal(error: unknown): boolean {
  return isApiError(error) && FINAL_STATUSES.has(error.status);
}

export function createPendingLogouts({ logout, storage = secureStorage, now = Date.now }: PendingLogoutsDeps): PendingLogouts {
  // Every read-modify-write runs after the previous one (one JS context; tabs only add their own).
  let queue: Promise<unknown> = Promise.resolve();
  let flushing: Promise<void> | null = null;
  /** Kept when storage fails, so the current launch still retries. */
  let memory: PendingLogout[] = [];

  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task, task);
    queue = run.catch(() => undefined);
    return run;
  };

  const load = async (): Promise<PendingLogout[]> => {
    let items: PendingLogout[];
    try {
      items = parse(await storage.read());
    } catch {
      items = memory;
    }
    const oldest = now() - MAX_AGE_MS;
    return items.filter((item) => item.since > oldest);
  };

  const save = async (items: PendingLogout[]): Promise<void> => {
    memory = items;
    try {
      await storage.write(items.length > 0 ? JSON.stringify(items) : null);
    } catch (error) {
      if (__DEV__) console.warn('[session] could not persist a pending sign-out', error);
    }
  };

  const update = (change: (items: PendingLogout[]) => PendingLogout[]) =>
    serial(async () => {
      await save(change(await load()));
    }).catch(() => undefined);

  const run = async () => {
    const items = await serial(load).catch(() => [] as PendingLogout[]);
    for (const item of items) {
      let done: boolean;
      try {
        await logout(item.refreshToken);
        done = true;
      } catch (error) {
        done = isFinalRefusal(error);
      }
      if (done) await update((current) => current.filter((other) => other.refreshToken !== item.refreshToken));
    }
  };

  return {
    add: (refreshToken) =>
      update((items) => [...items.filter((item) => item.refreshToken !== refreshToken), { refreshToken, since: now() }].slice(-MAX_PENDING)),
    discard: (refreshToken) => update((items) => items.filter((item) => item.refreshToken !== refreshToken)),
    flush() {
      flushing ??= run().finally(() => {
        flushing = null;
      });
      return flushing;
    },
    async pending() {
      return (await serial(load).catch(() => [] as PendingLogout[])).map((item) => item.refreshToken);
    },
  };
}
