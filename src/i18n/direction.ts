import { I18nManager, Platform } from 'react-native';

import type { AppLanguage } from '@/types/domain';

export const RTL_LANGUAGES: readonly AppLanguage[] = ['he'];

export function isRTLLanguage(language: AppLanguage): boolean {
  return RTL_LANGUAGES.includes(language);
}

export type LayoutDirection = 'ltr' | 'rtl';

/**
 * Web only: mirrors `dir`/`lang` onto `<html>` so content rendered outside the React root's DOM
 * node (portals: modals, sheets, dialogs) and browser UI (scrollbars, text inputs) follow the
 * language. No-op on native and during static rendering.
 */
export function applyDocumentDirection(language: AppLanguage): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const dir: LayoutDirection = isRTLLanguage(language) ? 'rtl' : 'ltr';
  const root = document.documentElement;
  if (root.dir !== dir) root.dir = dir;
  if (root.lang !== language) root.lang = language;
}

/**
 * Applies the layout direction for `language`.
 *
 * - Web: sets `dir`/`lang` on <html>. React Native Web resolves logical styles (`paddingStart`,
 *   `start`, `borderStartWidth`, …) from its own writing-direction context, which
 *   `LayoutDirectionRoot` (src/providers/layout-direction.tsx) provides for the whole tree.
 * - Native: calls `I18nManager.forceRTL`, which only takes effect after a reload. Returns
 *   `needsReload: true` when the running layout direction does not match yet.
 */
export function applyLayoutDirection(language: AppLanguage): { isRTL: boolean; needsReload: boolean } {
  const rtl = isRTLLanguage(language);

  if (Platform.OS === 'web') {
    applyDocumentDirection(language);
    return { isRTL: rtl, needsReload: false };
  }

  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
  I18nManager.swapLeftAndRightInRTL(true);
  return { isRTL: I18nManager.isRTL, needsReload: I18nManager.isRTL !== rtl };
}

/** Current effective layout direction. */
export function getIsRTL(language: AppLanguage): boolean {
  return Platform.OS === 'web' ? isRTLLanguage(language) : I18nManager.isRTL;
}
