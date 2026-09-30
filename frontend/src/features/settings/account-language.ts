/**
 * The account's language on the server (`PATCH /me`): the language of its push notifications and
 * emails. Kept in step with the app's language while signed in. Best effort, never throws.
 */
import { api } from '@/services/api';
import { sessionStore } from '@/services/auth/session-store';
import type { AppLanguage } from '@/types/domain';

/** Longest a language switch waits for the server before the app restarts (native RTL switch). */
const SYNC_TIMEOUT_MS = 3_000;

export async function syncAccountLanguage(language: AppLanguage, accountLanguage?: AppLanguage | null): Promise<void> {
  if (sessionStore.getState().status !== 'signedIn' || accountLanguage === language) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, SYNC_TIMEOUT_MS);
  });
  try {
    await Promise.race([api.users.updateMe({ preferredLanguage: language }).then(() => undefined), timeout]);
  } catch (error) {
    if (__DEV__) console.warn('[language] could not update the account language', error);
  } finally {
    clearTimeout(timer);
  }
}
