/**
 * The app-wide error boundary (exported as `ErrorBoundary` by `app/_layout.tsx`): a screen that
 * throws while rendering shows this instead of a white screen (web) or a fatal error (native),
 * with a retry. It renders in place of the root layout, so outside the app's providers: colors
 * come from the theme tokens directly and texts from the global i18n instance.
 */
import type { ErrorBoundaryProps } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { createTheme } from '@/theme';

export function AppErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { t, i18n } = useTranslation('errors');
  const theme = createTheme(useColorScheme() === 'dark' ? 'dark' : 'light', i18n.dir() === 'rtl');
  const { colors } = theme;

  useEffect(() => {
    if (__DEV__) console.error('[app] a screen failed to render', error);
  }, [error]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]} accessibilityRole="alert" testID="app-error-boundary">
      <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
        {t('crash.title')}
      </Text>
      <Text style={[styles.message, { color: colors.textSecondary }]}>{t('crash.message')}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => void retry()}
        style={({ pressed }) => [styles.button, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
        testID="app-error-retry"
      >
        <Text style={[styles.buttonLabel, { color: colors.onPrimary }]}>{t('crash.retry')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 20, fontWeight: '600', textAlign: 'center' },
  message: { fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 360 },
  button: { marginTop: 12, minHeight: 48, paddingHorizontal: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
});
