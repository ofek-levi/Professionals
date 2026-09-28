import { HeaderHeightContext } from 'expo-router/react-navigation';
import { useContext, type ReactNode, type Ref } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';

import { makeStyles, useTheme, type Theme } from '@/theme';

import { ScrollLockProvider, useScrollLockHost } from './scroll-lock';

interface ScreenProps {
  children: ReactNode;
  /** Scrollable content (default) or a static, full-height container. */
  scroll?: boolean;
  /**
   * Safe-area edges. Defaults to `['top', 'left', 'right']` (tab screens / header-less screens).
   * Add `'bottom'` for stack screens without a tab bar; it is applied to the scroll content (or
   * to the sticky footer) so content can scroll under the home indicator.
   */
  edges?: readonly Edge[];
  /** Horizontal `t.spacing.screen` padding. Defaults to `true`. */
  padded?: boolean;
  /** Vertical gap between direct children (spacing token). */
  gap?: keyof Theme['spacing'];
  /** Pull-to-refresh (scroll mode only). */
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Fixed content above the scroll area (search bar, segmented control…). */
  header?: ReactNode;
  /** Sticky bottom area for primary CTAs; respects the bottom inset. */
  footer?: ReactNode;
  keyboardAvoiding?: boolean;
  /**
   * Distance between the top of the window and the screen (keyboard avoidance measures the screen
   * relative to its parent). Defaults to the height of the navigation header above the screen, so
   * stack screens with a native header keep their footer CTA and last fields above the keyboard.
   */
  keyboardVerticalOffset?: number;
  /** Constrains content width on tablets / web. `false` disables it. */
  maxContentWidth?: number | false;
  scrollRef?: Ref<ScrollView>;
  scrollProps?: Omit<ScrollViewProps, 'children' | 'contentContainerStyle' | 'refreshControl'>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const DEFAULT_EDGES: readonly Edge[] = ['top', 'left', 'right'];

/**
 * Dragging the content dismisses the keyboard on native. react-native-web treats *every* scroll
 * event as a drag, including the browser scrolling a just-focused field into view, so 'on-drag'
 * would blur the field while the user types. The web keyboard is dismissed by the browser itself.
 */
const KEYBOARD_DISMISS_MODE = Platform.select({ ios: 'interactive', android: 'on-drag', default: 'none' } as const);

/**
 * Root container for every screen: safe areas, background, keyboard avoidance, pull-to-refresh,
 * readable max width on large screens and an optional sticky footer.
 */
export function Screen({
  children,
  scroll = true,
  edges = DEFAULT_EDGES,
  padded = true,
  gap,
  refreshing = false,
  onRefresh,
  header,
  footer,
  keyboardAvoiding = true,
  keyboardVerticalOffset,
  maxContentWidth,
  scrollRef,
  scrollProps,
  contentContainerStyle,
  style,
  testID,
}: ScreenProps) {
  const theme = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const headerHeight = useContext(HeaderHeightContext) ?? 0;
  // A map in the content can hold the scroll while it is dragged (see scroll-lock.tsx).
  const scrollLock = useScrollLockHost();

  const wantsBottomInset = edges.includes('bottom');
  const containerEdges = edges.filter((edge) => edge !== 'bottom');
  const bottomInset = wantsBottomInset && !footer ? insets.bottom : 0;
  const widthLimit = maxContentWidth === false ? undefined : (maxContentWidth ?? theme.layout.maxContentWidth);
  const constrained: ViewStyle = widthLimit ? { width: '100%', maxWidth: widthLimit, alignSelf: 'center' } : { width: '100%' };
  const contentPadding: ViewStyle = {
    paddingHorizontal: padded ? theme.spacing.screen : 0,
    gap: gap ? theme.spacing[gap] : undefined,
  };

  const body = scroll ? (
    <ScrollView
      ref={scrollRef}
      style={styles.flex}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={KEYBOARD_DISMISS_MODE}
      showsVerticalScrollIndicator={false}
      {...scrollProps}
      scrollEnabled={!scrollLock.locked && scrollProps?.scrollEnabled !== false}
      contentContainerStyle={[
        styles.scrollContent,
        constrained,
        contentPadding,
        { paddingBottom: theme.spacing.xxxl + bottomInset },
        contentContainerStyle,
      ]}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
            progressBackgroundColor={theme.colors.surface}
          />
        ) : undefined
      }
    >
      <ScrollLockProvider value={scrollLock.lock}>{children}</ScrollLockProvider>
    </ScrollView>
  ) : (
    <View style={[styles.flex, constrained, contentPadding, { paddingBottom: bottomInset }, contentContainerStyle]}>
      {children}
    </View>
  );

  return (
    <SafeAreaView edges={containerEdges} style={[styles.flex, { backgroundColor: theme.colors.background }, style]} testID={testID}>
      <KeyboardAvoidingView
        style={styles.flex}
        enabled={keyboardAvoiding && Platform.OS !== 'web'}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={keyboardVerticalOffset ?? headerHeight}
      >
        {header ? <View style={[constrained, { paddingHorizontal: padded ? theme.spacing.screen : 0 }]}>{header}</View> : null}
        {body}
        {footer ? (
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, theme.spacing.lg) }]}>
            <View style={[constrained, { paddingHorizontal: theme.spacing.screen }]}>{footer}</View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((t) => ({
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: t.spacing.md,
  },
  // Sticky CTA area: screen background with a single hairline, no shadow.
  footer: {
    paddingTop: t.spacing.md,
    backgroundColor: t.colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.border,
  },
}));
