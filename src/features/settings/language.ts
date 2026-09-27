/**
 * Language switching and the right-to-left layout it implies.
 *
 * - Web: `applyLayoutDirection` flips `<html dir>` live, no reload needed.
 * - iOS/Android: `I18nManager.forceRTL` only takes effect after a reload, so switching between an
 *   LTR and an RTL language reloads the app once (`reloadAppAsync`). A persisted flag prevents
 *   reload loops if the platform refuses to change direction (e.g. some Expo Go setups).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { reloadAppAsync } from 'expo';
import { Platform } from 'react-native';

import { i18n, storeLanguage } from '@/i18n';
import { applyLayoutDirection, getIsRTL, isRTLLanguage } from '@/i18n/direction';
import type { AppLanguage } from '@/types/domain';

const RELOAD_FLAG_KEY = '@professionals/direction-reload/v1';

/** `true` when switching to `language` requires a native reload to flip the running layout direction. */
export function requiresReloadForLanguage(language: AppLanguage): boolean {
  if (Platform.OS === 'web') return false;
  return isRTLLanguage(language) !== getIsRTL(language);
}

/** Persists the direction attempt and reloads the JS bundle so the new direction applies. */
export async function reloadForLayoutDirection(language: AppLanguage): Promise<void> {
  try {
    await AsyncStorage.setItem(RELOAD_FLAG_KEY, language);
  } catch {
    // Without the flag we may reload once more at startup; still bounded by the check below.
  }
  await reloadAppAsync(`Layout direction changed for "${language}"`);
}

export type DirectionStartupResult = 'ready' | 'reloading';

/**
 * Startup step: applies the layout direction for `language`. When the running direction does not
 * match (native only), reloads once; if a reload for this language was already attempted, gives
 * up and continues (the UI still works, only mirrored layout is off) instead of looping.
 */
export async function ensureLayoutDirection(language: AppLanguage): Promise<DirectionStartupResult> {
  const { needsReload } = applyLayoutDirection(language);
  let attempted: string | null = null;
  try {
    attempted = await AsyncStorage.getItem(RELOAD_FLAG_KEY);
  } catch {
    attempted = null;
  }
  if (!needsReload) {
    if (attempted !== null) await AsyncStorage.removeItem(RELOAD_FLAG_KEY).catch(() => undefined);
    return 'ready';
  }
  if (attempted === language) {
    if (__DEV__) console.warn(`[i18n] Layout direction for "${language}" could not be applied after a reload.`);
    return 'ready';
  }
  try {
    await reloadForLayoutDirection(language);
    return 'reloading';
  } catch {
    return 'ready';
  }
}

/**
 * Applies a new language without reloading: persists it, switches i18next and updates the layout
 * direction (live on web). Use `requiresReloadForLanguage` first on native.
 */
export async function applyLanguage(language: AppLanguage): Promise<void> {
  await storeLanguage(language);
  await i18n.changeLanguage(language);
  applyLayoutDirection(language);
}

/** Persists and applies a language that needs a native reload, then reloads. */
export async function applyLanguageWithReload(language: AppLanguage): Promise<void> {
  await storeLanguage(language);
  applyLayoutDirection(language);
  await reloadForLayoutDirection(language);
}
