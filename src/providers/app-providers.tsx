/**
 * The app's provider tree (outermost first):
 * gestures → safe area → React Query → design theme → navigation theme/direction → web layout
 * direction root → session → dialogs → toasts → realtime.
 */
import { QueryClientProvider } from '@tanstack/react-query';
import { LocaleProvider, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import * as SystemUI from 'expo-system-ui';
import { useEffect, type ReactNode } from 'react';
import { Appearance, Platform, StyleSheet, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DialogProvider, ToastProvider } from '@/components/ui';
import { SessionProvider } from '@/features/auth/session-provider';
import { useSettings, type ColorSchemePreference } from '@/features/settings/settings-store';
import { getIsRTL } from '@/i18n/direction';
import { useAppLanguage } from '@/i18n/hooks';
import type { AppLanguage } from '@/types/domain';
import { bindQueryFocusToAppState, queryClient } from '@/lib/query-client';
import { AppThemeProvider, useTheme } from '@/theme';

import { LayoutDirectionRoot } from './layout-direction';
import { buildNavigationTheme } from './navigation-theme';
import { RealtimeProvider } from './realtime-provider';

/** Resolves the effective scheme from the user preference and the device setting. */
export function resolveColorScheme(preference: ColorSchemePreference, system: string | null | undefined): 'light' | 'dark' {
  if (preference !== 'system') return preference;
  return system === 'dark' ? 'dark' : 'light';
}

function useEffectiveColorScheme(): 'light' | 'dark' {
  const { colorScheme: preference } = useSettings();
  const system = useColorScheme();

  // Native controls (alerts, pickers, keyboard) follow the forced scheme too.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
  }, [preference]);

  return resolveColorScheme(preference, system);
}

/**
 * Navigation theme + layout direction for headers/back buttons, from the active design theme, and
 * (web) the writing-direction root that mirrors logical styles of the whole tree, portals included.
 */
function NavigationChrome({ language, children }: { language: AppLanguage; children: ReactNode }) {
  const theme = useTheme();

  // Root view background (visible during transitions and behind the keyboard).
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(theme.colors.background).catch(() => undefined);
  }, [theme.colors.background]);

  return (
    <LocaleProvider direction={theme.isRTL ? 'rtl' : 'ltr'}>
      <NavigationThemeProvider value={buildNavigationTheme(theme)}>
        <LayoutDirectionRoot language={language}>{children}</LayoutDirectionRoot>
      </NavigationThemeProvider>
    </LocaleProvider>
  );
}

export function AppProviders({ children }: { children: ReactNode }) {
  const scheme = useEffectiveColorScheme();
  const language = useAppLanguage();
  const isRTL = getIsRTL(language);

  useEffect(() => bindQueryFocusToAppState(), []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AppThemeProvider scheme={scheme} isRTL={isRTL}>
            <NavigationChrome language={language}>
              <SessionProvider>
                <DialogProvider>
                  <ToastProvider>
                    <RealtimeProvider>{children}</RealtimeProvider>
                  </ToastProvider>
                </DialogProvider>
              </SessionProvider>
            </NavigationChrome>
          </AppThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
