/**
 * Navigation look & feel derived from the design tokens: the React Navigation theme, root stack
 * header options and bottom tab bar options. Used by `src/app` layouts.
 */
import type { Theme as NavigationTheme } from 'expo-router';
import type { ColorValue } from 'react-native';

import { Icon, type IconName } from '@/components/ui';
import type { Theme } from '@/theme';

/** React Navigation theme built from tokens (drives native headers, tab bar defaults, backgrounds). */
export function buildNavigationTheme(theme: Theme): NavigationTheme {
  const { colors, fonts } = theme;
  return {
    dark: theme.scheme === 'dark',
    colors: {
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.danger,
    },
    fonts: {
      regular: { fontFamily: fonts.regular, fontWeight: '400' },
      medium: { fontFamily: fonts.medium, fontWeight: '500' },
      bold: { fontFamily: fonts.semibold, fontWeight: '600' },
      heavy: { fontFamily: fonts.bold, fontWeight: '700' },
    },
  };
}

/** Options shared by every screen of the root stack. */
export function buildStackScreenOptions(theme: Theme) {
  const { colors, fonts } = theme;
  return {
    headerStyle: { backgroundColor: colors.background },
    headerShadowVisible: false,
    headerTintColor: colors.text,
    headerTitleAlign: 'center' as const,
    headerTitleStyle: { fontFamily: fonts.semibold, fontSize: 17, color: colors.text },
    headerBackTitleStyle: { fontFamily: fonts.regular },
    // Icon-only back button: no truncated localized labels, mirrors automatically in RTL.
    headerBackButtonDisplayMode: 'minimal' as const,
    contentStyle: { backgroundColor: colors.background },
  };
}

/** Options shared by every tab of the customer/professional tab bars (screens render their own headers). */
export function buildTabScreenOptions(theme: Theme) {
  const { colors, fonts } = theme;
  return {
    headerShown: false,
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.textMuted,
    tabBarStyle: {
      backgroundColor: colors.tabBar,
      borderTopColor: colors.border,
    },
    tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
    tabBarBadgeStyle: {
      backgroundColor: colors.danger,
      color: colors.onPrimary,
      fontFamily: fonts.medium,
      fontSize: 10,
    },
    sceneStyle: { backgroundColor: colors.background },
    tabBarHideOnKeyboard: true,
  };
}

export interface TabIconSet {
  idle: IconName;
  focused: IconName;
}

/** `tabBarIcon` renderer switching between the outline (idle) and filled (focused) glyph. */
export function tabBarIcon(icons: TabIconSet) {
  function renderTabBarIcon({ focused, color, size }: { focused: boolean; color: ColorValue; size: number }) {
    // Tints come from the theme as plain strings; platform colors fall back to the default text color.
    return <Icon name={focused ? icons.focused : icons.idle} color={typeof color === 'string' ? color : undefined} size={size} />;
  }
  return renderTabBarIcon;
}

/** Tab badge text for an unread count (`undefined` hides the badge). */
export function formatTabBadge(count: number | undefined): string | number | undefined {
  if (!count || count <= 0) return undefined;
  return count > 99 ? '99+' : count;
}
