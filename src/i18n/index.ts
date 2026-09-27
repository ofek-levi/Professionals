/**
 * i18next setup. Language resolution order: saved preference → device language → English.
 * Call `initI18n()` once before rendering (the root layout does this).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { SUPPORTED_LANGUAGES, type AppLanguage } from '@/types/domain';

import { defaultNS, NAMESPACES, resources } from './resources';

const LANGUAGE_STORAGE_KEY = '@professionals/language/v1';

export function isSupportedLanguage(value: unknown): value is AppLanguage {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

export function getDeviceLanguage(): AppLanguage {
  try {
    const code = getLocales()[0]?.languageCode;
    // `iw` is the legacy ISO code for Hebrew still reported by some Android devices.
    if (code === 'iw') return 'he';
    return isSupportedLanguage(code) ? code : 'en';
  } catch {
    return 'en';
  }
}

export async function getStoredLanguage(): Promise<AppLanguage | null> {
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isSupportedLanguage(stored) ? stored : null;
  } catch {
    return null;
  }
}

export async function storeLanguage(language: AppLanguage): Promise<void> {
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Non critical.
  }
}

let initPromise: Promise<AppLanguage> | null = null;

/** Initializes i18next synchronously-safe for tests (pass `language`) or from storage. */
export function initI18n(language?: AppLanguage): Promise<AppLanguage> {
  if (!initPromise) {
    initPromise = (async () => {
      const resolved = language ?? (await getStoredLanguage()) ?? getDeviceLanguage();
      // eslint-disable-next-line import/no-named-as-default-member -- i18next's documented plugin API
      await i18n.use(initReactI18next).init({
        resources,
        lng: resolved,
        fallbackLng: 'en',
        ns: NAMESPACES,
        defaultNS,
        interpolation: { escapeValue: false },
        returnNull: false,
        react: { useSuspense: false },
      });
      return resolved;
    })();
  }
  return initPromise;
}

export function getCurrentLanguage(): AppLanguage {
  return isSupportedLanguage(i18n.language) ? i18n.language : 'en';
}

export { i18n };
