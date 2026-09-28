/**
 * Everything that must happen before the first screen renders (the splash screen stays up
 * meanwhile): fonts, i18n, layout direction (may reload the app once on native), the persisted
 * session and the device settings.
 */
import { Rubik_400Regular } from '@expo-google-fonts/rubik/400Regular';
import { Rubik_500Medium } from '@expo-google-fonts/rubik/500Medium';
import { Rubik_600SemiBold } from '@expo-google-fonts/rubik/600SemiBold';
import { Rubik_700Bold } from '@expo-google-fonts/rubik/700Bold';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFonts } from 'expo-font';
import { useEffect, useState } from 'react';

import { ensureLayoutDirection } from '@/features/settings/language';
import { settingsStore } from '@/features/settings/settings-store';
import { initI18n } from '@/i18n';
import { sessionStore } from '@/services/auth/session-store';
import { fontFamilies } from '@/theme';

const FONTS = {
  [fontFamilies.regular]: Rubik_400Regular,
  [fontFamilies.medium]: Rubik_500Medium,
  [fontFamilies.semibold]: Rubik_600SemiBold,
  [fontFamilies.bold]: Rubik_700Bold,
  // Tab bar icon font, loaded up front so the tab icons never pop in.
  ...Ionicons.font,
};

type BootState = 'loading' | 'ready' | 'reloading';

async function bootstrap(): Promise<BootState> {
  const language = await initI18n();
  const direction = await ensureLayoutDirection(language);
  if (direction === 'reloading') return 'reloading';
  await Promise.all([sessionStore.hydrate(), settingsStore.hydrate()]);
  return 'ready';
}

/** `true` once the app can render. Font loading errors don't block startup (system fonts are used). */
export function useAppBootstrap(): boolean {
  const [fontsLoaded, fontError] = useFonts(FONTS);
  const [state, setState] = useState<BootState>('loading');

  useEffect(() => {
    let active = true;
    bootstrap()
      .catch(async (error: unknown): Promise<BootState> => {
        if (__DEV__) console.warn('[bootstrap] startup step failed, continuing', error);
        // Both stores fall back to safe defaults internally; never leave the session "loading".
        await Promise.allSettled([sessionStore.hydrate(), settingsStore.hydrate()]);
        return 'ready';
      })
      .then((next) => {
        if (active) setState(next);
      });
    return () => {
      active = false;
    };
  }, []);

  return state === 'ready' && (fontsLoaded || fontError !== null);
}
