/**
 * Where credentials are kept (the session, sign-outs the server has not confirmed yet):
 * - iOS/Android: `expo-secure-store` (Keychain / Android Keystore), readable after the first unlock
 *   and never included in backups or restored to another device;
 * - web: `localStorage` (see `session-store.ts` for the trade-off).
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const SECURE_OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

export const isWebStorage = Platform.OS === 'web';

/** The web's `localStorage`, or `null` (native, or storage disabled in privacy mode). */
export function webStorage(): Storage | null {
  if (!isWebStorage) return null;
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Reads `key` (SecureStore keys may only contain letters, digits, `.`, `-` and `_`). */
export async function readSecureItem(key: string): Promise<string | null> {
  if (isWebStorage) return webStorage()?.getItem(key) ?? null;
  return SecureStore.getItemAsync(key, SECURE_OPTIONS);
}

/** Writes `key`, or deletes it when `value` is `null`. */
export async function writeSecureItem(key: string, value: string | null): Promise<void> {
  if (isWebStorage) {
    const storage = webStorage();
    if (value === null) storage?.removeItem(key);
    else storage?.setItem(key, value);
    return;
  }
  if (value === null) await SecureStore.deleteItemAsync(key, SECURE_OPTIONS);
  else await SecureStore.setItemAsync(key, value, SECURE_OPTIONS);
}
