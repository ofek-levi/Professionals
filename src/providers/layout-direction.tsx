/**
 * Layout direction for the whole app on web.
 *
 * Native mirrors through `I18nManager` (applied at startup), so this is a pass-through there.
 * React Native Web does not read `<html dir>` when it resolves logical styles: `paddingStart`,
 * `marginEnd`, `start`/`end` and `borderStart*` follow its own writing-direction context, which
 * defaults to LTR. A root `View` with `dir` sets that context for every descendant (React context
 * also reaches portals such as modals, sheets, dialogs and toasts) and the DOM `dir` attribute for
 * CSS (flex rows, text alignment). `<html dir>` is kept in sync for portal DOM nodes and browser UI.
 */
import { useLayoutEffect, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { applyDocumentDirection, isRTLLanguage, type LayoutDirection } from '@/i18n/direction';
import type { AppLanguage } from '@/types/domain';

export function getLayoutDirection(language: AppLanguage): LayoutDirection {
  return isRTLLanguage(language) ? 'rtl' : 'ltr';
}

export function LayoutDirectionRoot({ language, children }: { language: AppLanguage; children: ReactNode }) {
  const direction = getLayoutDirection(language);

  useLayoutEffect(() => {
    applyDocumentDirection(language);
  }, [language]);

  if (Platform.OS !== 'web') return children;

  return (
    <View style={styles.root} dir={direction}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
