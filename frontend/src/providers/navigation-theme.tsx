/**
 * Navigation look & feel derived from the design tokens: the React Navigation theme, root stack
 * header options and bottom tab bar options. Used by `src/app` layouts.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Theme as NavigationTheme } from 'expo-router';
import type { ComponentProps } from 'react';
import { StyleSheet, type ColorValue } from 'react-native';

import type { Theme } from '@/theme';

/** React Navigation theme built from tokens (drives native headers, tab bar defaults, backgrounds). */
export function buildNavigationTheme(theme: Theme): NavigationTheme {
  const { colors, fonts } = theme;
  return {
    dark: theme.scheme === 'dark',
    colors: {
      primary: colors.primary,
      background: colors.background,
      card: colors.background,
      text: colors.text,
      border: colors.border,
      notification: colors.danger,
    },
    // Each weight is its own font family. Keep `fontWeight` below 700: Android registers a loaded
    // font only as the regular style and would draw a bold-weighted custom family in the system font.
    fonts: {
      regular: { fontFamily: fonts.regular, fontWeight: '400' },
      medium: { fontFamily: fonts.medium, fontWeight: '500' },
      bold: { fontFamily: fonts.semibold, fontWeight: '600' },
      heavy: { fontFamily: fonts.bold, fontWeight: '400' },
    },
  };
}

/**
 * Options shared by every screen of the root stack: a minimal header on the screen background
 * (no shadow or border), a 17pt semibold centered title and an icon-only back arrow that mirrors
 * in RTL.
 */
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

/** Size of every tab bar glyph (outline when idle, filled when focused). */
const TAB_BAR_ICON_SIZE = 24;

/** Tab bar glyphs come from Ionicons: soft, rounded shapes with matching outline/filled pairs. */
type TabIconName = ComponentProps<typeof Ionicons>['name'];

/**
 * Options shared by every tab of the customer/professional tab bars (screens render their own
 * headers). The bar sits on the screen background with a single hairline on top – no shadow,
 * elevation or selection pill – and is `layout.tabBarHeight` tall above the bottom inset.
 */
export function buildTabScreenOptions(theme: Theme, bottomInset = 0) {
  const { colors, fonts, layout } = theme;
  return {
    headerShown: false,
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.textMuted,
    tabBarLabelPosition: 'below-icon' as const,
    tabBarStyle: {
      // Item: 5 padding + 28 icon box + 14 label + 5 padding, vertically centered in the bar.
      height: layout.tabBarHeight + bottomInset,
      paddingTop: 3,
      backgroundColor: colors.tabBar,
      borderTopColor: colors.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      elevation: 0,
      shadowOpacity: 0,
      boxShadow: 'none',
    },
    tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 14 },
    tabBarBadgeStyle: {
      backgroundColor: colors.tones.danger.solid,
      color: colors.onPrimary,
      fontFamily: fonts.medium,
      fontSize: 10,
      lineHeight: 16,
      height: 16,
      minWidth: 16,
      borderRadius: 8,
      paddingHorizontal: 4,
      top: -2,
    },
    sceneStyle: { backgroundColor: colors.background },
    tabBarHideOnKeyboard: true,
  };
}

interface TabIconSet {
  idle: TabIconName;
  focused: TabIconName;
}

/** `tabBarIcon` renderer switching between the outline (idle) and filled (focused) glyph. */
export function tabBarIcon(icons: TabIconSet) {
  function renderTabBarIcon({ focused, color }: { focused: boolean; color: ColorValue; size: number }) {
    // Tints come from the theme as plain strings; platform colors fall back to the default text color.
    return (
      <Ionicons
        name={focused ? icons.focused : icons.idle}
        color={typeof color === 'string' ? color : undefined}
        size={TAB_BAR_ICON_SIZE}
      />
    );
  }
  return renderTabBarIcon;
}

/** Tab badge text for an unread count (`undefined` hides the badge). */
export function formatTabBadge(count: number | undefined): string | number | undefined {
  if (!count || count <= 0) return undefined;
  return count > 99 ? '99+' : count;
}
