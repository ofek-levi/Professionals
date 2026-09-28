import { useEffect, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { makeStyles, useTheme } from '@/theme';

import { AppText } from './app-text';
import { IconButton } from './icon-button';
import { usePanGesture } from './pan-gesture';
import { ScrollLockProvider, useScrollLockHost } from './scroll-lock';

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  /** Sticky actions at the bottom (respects the bottom safe area). */
  footer?: ReactNode;
  /** Wrap content in a ScrollView (default `true`). */
  scrollable?: boolean;
  /** Allow closing via backdrop, swipe down and hardware back (default `true`). */
  dismissible?: boolean;
  /** Always use the maximum height (useful for searchable lists that change size). */
  fullHeight?: boolean;
  /** Fraction of the window height the sheet may use (default 0.9). */
  maxHeightRatio?: number;
  /** Horizontal content padding (default `true`). */
  padded?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

const OPEN_DURATION_MS = 280;
const CLOSE_DURATION_MS = 200;
const DISMISS_DISTANCE = 90;

/**
 * Bottom sheet built on `Modal` (works on native and web): backdrop fade, slide-up animation,
 * swipe-down / backdrop / back-button dismissal, title bar and sticky footer.
 */
export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  scrollable = true,
  dismissible = true,
  fullHeight = false,
  maxHeightRatio = 0.9,
  padded = true,
  contentContainerStyle,
  testID,
}: SheetProps) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation('common');
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  // A map in the content can hold the scroll while it is dragged (see scroll-lock.tsx).
  const scrollLock = useScrollLockHost();

  // Keep the modal mounted while the exit animation runs.
  const [prevVisible, setPrevVisible] = useState(visible);
  const [closing, setClosing] = useState(false);
  if (prevVisible !== visible) {
    setPrevVisible(visible);
    setClosing(!visible);
  }

  const progress = useSharedValue(0);
  const drag = useSharedValue(0);
  const [sheetHeight, setSheetHeight] = useState(0);

  useEffect(() => {
    if (visible) {
      drag.set(0);
      progress.set(withTiming(1, { duration: OPEN_DURATION_MS, easing: Easing.out(Easing.cubic) }));
    } else {
      progress.set(
        withTiming(0, { duration: CLOSE_DURATION_MS, easing: Easing.in(Easing.cubic) }, (finished) => {
          if (finished) scheduleOnRN(setClosing, false);
        }),
      );
    }
  }, [visible, progress, drag]);

  const travel = sheetHeight > 0 ? sheetHeight : windowHeight;
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.get()) * travel + drag.get() }],
  }), [travel]);
  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.get() }));

  const panHandlers = usePanGesture({
    claimOnMove: (gesture) => dismissible && gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onMove: (gesture) => drag.set(Math.max(0, gesture.dy)),
    onRelease: (gesture) => {
      if (gesture.dy > DISMISS_DISTANCE || gesture.vy > 1.2) onClose();
      else drag.set(withSpring(0, { damping: 20, stiffness: 220 }));
    },
    onTerminate: () => drag.set(withSpring(0)),
  });

  const content = scrollable ? (
    <ScrollView
      style={fullHeight ? styles.flex : styles.scroll}
      contentContainerStyle={[padded ? styles.padded : null, styles.scrollContent, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      scrollEnabled={!scrollLock.locked}
    >
      <ScrollLockProvider value={scrollLock.lock}>{children}</ScrollLockProvider>
    </ScrollView>
  ) : (
    <View style={[padded ? styles.padded : null, fullHeight ? styles.flex : null, contentContainerStyle]}>{children}</View>
  );

  return (
    <Modal
      transparent
      visible={visible || closing}
      animationType="none"
      onRequestClose={dismissible ? onClose : () => undefined}
      statusBarTranslucent
      navigationBarTranslucent
      supportedOrientations={['portrait', 'landscape']}
      testID={testID}
    >
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.close')}
            onPress={dismissible ? onClose : undefined}
          />
        </Animated.View>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.avoider}
        >
          <Animated.View
            accessibilityViewIsModal
            onLayout={(event) => setSheetHeight(event.nativeEvent.layout.height)}
            style={[
              styles.sheet,
              {
                maxHeight: windowHeight * maxHeightRatio,
                paddingBottom: footer ? 0 : Math.max(insets.bottom, theme.spacing.lg),
              },
              fullHeight ? { height: windowHeight * maxHeightRatio } : null,
              sheetStyle,
            ]}
          >
            <View {...panHandlers} style={styles.header}>
              <View style={styles.handle} />
              {title || dismissible ? (
                <View style={styles.titleRow}>
                  <View style={styles.titleTexts}>
                    {title ? (
                      <AppText variant="heading" accessibilityRole="header" numberOfLines={2}>
                        {title}
                      </AppText>
                    ) : null}
                    {subtitle ? (
                      <AppText variant="caption" color="muted" numberOfLines={2}>
                        {subtitle}
                      </AppText>
                    ) : null}
                  </View>
                  {dismissible ? (
                    <IconButton icon="close" size="sm" variant="soft" tone="neutral" accessibilityLabel={t('a11y.close')} onPress={onClose} />
                  ) : null}
                </View>
              ) : null}
            </View>
            {content}
            {footer ? (
              <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, theme.spacing.lg) }]}>{footer}</View>
            ) : null}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((t) => ({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  backdrop: {
    backgroundColor: t.colors.overlay,
  },
  avoider: {
    flex: 1,
    pointerEvents: 'box-none',
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    backgroundColor: t.colors.surfaceElevated,
    borderTopStartRadius: t.radii.xxl,
    borderTopEndRadius: t.radii.xxl,
    overflow: 'hidden',
    ...t.shadows.lg,
  },
  header: {
    paddingTop: t.spacing.sm,
    paddingHorizontal: t.spacing.screen,
    paddingBottom: t.spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: t.radii.pill,
    backgroundColor: t.colors.borderStrong,
    marginBottom: t.spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.spacing.md,
  },
  titleTexts: {
    flex: 1,
    gap: t.spacing.xxs,
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  scrollContent: {
    paddingBottom: t.spacing.lg,
  },
  padded: {
    paddingHorizontal: t.spacing.screen,
  },
  footer: {
    paddingTop: t.spacing.md,
    paddingHorizontal: t.spacing.screen,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.border,
    backgroundColor: t.colors.surfaceElevated,
    gap: t.spacing.sm,
  },
}));
