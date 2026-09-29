import { useEffect, useEffectEvent, useState, type ReactNode } from 'react';
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
import { DialogOutlet } from './dialog-provider';
import { IconButton } from './icon-button';
import { useKeyboardVisible } from './keyboard';
import { useOverlayHost } from './overlay-host';
import { usePanGesture } from './pan-gesture';
import { ScrollLockProvider, useScrollLockHost } from './scroll-lock';
import { ToastOutlet } from './toast-provider';

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  /**
   * Called once the sheet has fully closed (exit animation done, its Modal gone). Start anything
   * that presents its own screen here, e.g. the image picker: iOS cannot present it over a sheet
   * that is still being dismissed.
   */
  onClosed?: () => void;
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

const IS_WEB = Platform.OS === 'web';
const OPEN_DURATION_MS = 280;
const CLOSE_DURATION_MS = 200;
const DISMISS_DISTANCE = 90;

/**
 * Bottom sheet built on `Modal` (works on native and web): backdrop fade, slide-up animation,
 * swipe-down / backdrop / back-button dismissal, title bar and sticky footer. It rises above the
 * software keyboard and shrinks (its content scrolls) when the keyboard leaves too little room.
 * While open it hosts the app's toasts and confirm dialogs (see overlay-host.tsx).
 */
export function Sheet({
  visible,
  onClose,
  onClosed,
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
  const isOverlayHost = useOverlayHost(visible);
  // The keyboard covers the bottom safe area; the keyboard-avoiding view puts the sheet right on it.
  const keyboardVisible = useKeyboardVisible();
  const bottomPadding = keyboardVisible ? theme.spacing.lg : Math.max(insets.bottom, theme.spacing.lg);

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

  const finishClosing = useEffectEvent(() => {
    // Only a sheet that was open and is still closing (not reopened, not mounted hidden) has closed.
    if (!closing) return;
    setClosing(false);
    // iOS reports it from the Modal once the native dismissal has completed (`onDismiss` below).
    if (Platform.OS !== 'ios') onClosed?.();
  });

  useEffect(() => {
    if (visible) {
      drag.set(0);
      progress.set(withTiming(1, { duration: OPEN_DURATION_MS, easing: Easing.out(Easing.cubic) }));
    } else {
      progress.set(
        withTiming(0, { duration: CLOSE_DURATION_MS, easing: Easing.in(Easing.cubic) }, (finished) => {
          if (finished) scheduleOnRN(finishClosing);
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
      onDismiss={Platform.OS === 'ios' ? onClosed : undefined}
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
        {/* Padding on both platforms: the Android Modal window is edge to edge (enforced from
            Android 15), so the system no longer resizes it for the keyboard. Where a window is
            still resized, the keyboard no longer overlaps it and the padding is 0. */}
        <KeyboardAvoidingView
          behavior={IS_WEB ? undefined : 'padding'}
          style={[styles.avoider, { paddingTop: insets.top + theme.spacing.sm }]}
        >
          <Animated.View
            accessibilityViewIsModal
            onLayout={(event) => setSheetHeight(event.nativeEvent.layout.height)}
            style={[
              styles.sheet,
              { maxHeight: windowHeight * maxHeightRatio, paddingBottom: footer ? 0 : bottomPadding },
              // Takes all the room up to its max height, and gives it back to the keyboard.
              fullHeight ? styles.flex : null,
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
              <View style={[styles.footer, { paddingBottom: bottomPadding }]}>{footer}</View>
            ) : null}
          </Animated.View>
        </KeyboardAvoidingView>
        {isOverlayHost ? <OverlayOutlet onToastAction={dismissible ? onClose : undefined} /> : null}
      </View>
    </Modal>
  );
}

/**
 * The app's toasts and confirm dialog, drawn above the sheet (inside its Modal). Tapping a toast
 * with an action (a push banner opening a screen) closes the sheet first.
 */
function OverlayOutlet({ onToastAction }: { onToastAction?: () => void }) {
  return (
    <>
      <ToastOutlet beforeAction={onToastAction} />
      <DialogOutlet />
    </>
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
    // Shrinks (the scroll area first) instead of overflowing the top when the keyboard is up.
    flexShrink: 1,
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
