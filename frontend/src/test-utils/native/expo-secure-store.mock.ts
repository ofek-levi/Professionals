/**
 * In-memory `expo-secure-store` for Jest (the Keychain / Keystore module is native). Records the
 * options of every write so tests can check the accessibility class. The items live on
 * `globalThis`, so they survive `jest.isolateModules` (a simulated app relaunch).
 */
type Options = { keychainAccessible?: number };

interface SecureStoreState {
  items: Map<string, string>;
  writes: { key: string; options: Options | undefined }[];
}

const holder = globalThis as typeof globalThis & { __secureStoreState?: SecureStoreState };
holder.__secureStoreState ??= { items: new Map(), writes: [] };
const { items, writes } = holder.__secureStoreState;

export const AFTER_FIRST_UNLOCK = 0;
export const AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY = 1;
export const ALWAYS = 2;
export const WHEN_PASSCODE_SET_THIS_DEVICE_ONLY = 3;
export const ALWAYS_THIS_DEVICE_ONLY = 4;
export const WHEN_UNLOCKED = 5;
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 6;

export async function isAvailableAsync(): Promise<boolean> {
  return true;
}

export async function getItemAsync(key: string): Promise<string | null> {
  return items.get(key) ?? null;
}

export async function setItemAsync(key: string, value: string, options?: Options): Promise<void> {
  if (!/^[\w.-]+$/.test(key)) throw new Error(`Invalid SecureStore key "${key}"`);
  writes.push({ key, options });
  items.set(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  items.delete(key);
}

/** Test helpers (not part of expo-secure-store). */
export const __secureStore = {
  items,
  writes,
  reset(): void {
    items.clear();
    writes.length = 0;
  },
};
