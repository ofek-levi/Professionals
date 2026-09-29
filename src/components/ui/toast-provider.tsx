import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInUp, FadeOutUp, LinearTransition, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import type { StatusTone } from '@/constants/tones';
import { makeStyles, useTheme } from '@/theme';

import { AppText } from './app-text';
import { haptics } from './haptics';
import { Icon, type IconName, type IconSource } from './icon';
import { useOverlaysAtRoot } from './overlay-host';
import { usePanGesture } from './pan-gesture';

interface ToastOptions {
  title: string;
  message?: string;
  tone?: StatusTone;
  icon?: IconSource;
  /** Makes the toast tappable (e.g. open the notification target). The toast closes on tap. */
  onPress?: () => void;
  /** Auto-dismiss delay; defaults to 4 s (5.5 s with a message). */
  durationMs?: number;
  /** Replaces a visible/queued toast with the same id instead of stacking a duplicate. */
  id?: string;
}

interface ToastApi {
  /** Shows a toast and returns its id. */
  show: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

interface ToastItem extends ToastOptions {
  id: string;
}

interface ToastState {
  toasts: readonly ToastItem[];
  dismiss: (id: string) => void;
}

const MAX_VISIBLE = 3;
const ToastContext = createContext<ToastApi | null>(null);
const ToastStateContext = createContext<ToastState | null>(null);

let nextToastId = 1;

const TONE_ICONS: Record<StatusTone, IconName> = {
  neutral: 'bell-outline',
  info: 'information-outline',
  success: 'check-circle-outline',
  warning: 'alert-outline',
  danger: 'alert-circle-outline',
  accent: 'bell-ring-outline',
  brand: 'bell-badge-outline',
};

/**
 * Hosts in-app toasts / simulated push banners at the top of the screen. Mount once near the root,
 * inside `SafeAreaProvider`, the theme and i18n providers and `OverlayHostProvider`. The toasts show
 * at the root, or inside the top-most open `Sheet` (above its backdrop).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const atRoot = useOverlaysAtRoot();

  const dismiss = useCallback((id: string) => setToasts((items) => items.filter((item) => item.id !== id)), []);

  const api: ToastApi = {
    show: (options) => {
      const id = options.id ?? `toast-${nextToastId++}`;
      setToasts((items) => {
        const exists = items.some((item) => item.id === id);
        return exists ? items.map((item) => (item.id === id ? { ...options, id } : item)) : [...items, { ...options, id }];
      });
      if (options.tone === 'danger') haptics.error();
      else if (options.tone === 'success') haptics.success();
      else haptics.light();
      AccessibilityInfo.announceForAccessibility(options.message ? `${options.title}. ${options.message}` : options.title);
      return id;
    },
    dismiss,
    dismissAll: () => setToasts([]),
  };

  return (
    <ToastContext.Provider value={api}>
      <ToastStateContext.Provider value={{ toasts, dismiss }}>
        {children}
        {atRoot ? <ToastOutlet /> : null}
      </ToastStateContext.Provider>
    </ToastContext.Provider>
  );
}

/**
 * Renders the visible toasts at the top of the screen: at the app root or inside the top-most sheet.
 * `beforeAction` runs before a tappable toast's own action: the hosting sheet closes, so the screen
 * that action opens is not left hidden behind it.
 */
export function ToastOutlet({ beforeAction }: { beforeAction?: () => void }) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const state = useContext(ToastStateContext);
  if (!state) return null;
  // FIFO queue: the oldest visible toasts leave first; newest is rendered on top.
  const visible = state.toasts.slice(0, MAX_VISIBLE).reverse();

  return (
    <View style={[styles.host, { top: insets.top + 8 }]}>
      {visible.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={state.dismiss} beforeAction={beforeAction} />
      ))}
    </View>
  );
}

const fallbackToast: ToastApi = {
  show: (options) => {
    if (__DEV__) console.warn('useToast() was called outside <ToastProvider>.', options.title);
    return '';
  },
  dismiss: () => undefined,
  dismissAll: () => undefined,
};

/** `const toast = useToast(); toast.show({ title: t('…'), tone: 'success' })` */
export function useToast(): ToastApi {
  return useContext(ToastContext) ?? fallbackToast;
}

function ToastCard({
  toast,
  onDismiss,
  beforeAction,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
  beforeAction?: () => void;
}) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation('common');
  const tone = theme.colors.tones[toast.tone ?? 'neutral'];
  const offset = useSharedValue(0);
  const duration = toast.durationMs ?? (toast.message ? 5500 : 4000);

  // Restarts when the toast content is replaced (same id, new options).
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), duration);
    return () => clearTimeout(timer);
  }, [toast, duration, onDismiss]);

  const close = () => onDismiss(toast.id);

  const panHandlers = usePanGesture({
    claimOnMove: (gesture) => Math.abs(gesture.dy) > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onMove: (gesture) => offset.set(Math.min(gesture.dy, 12)),
    onRelease: (gesture) => {
      if (gesture.dy < -28 || gesture.vy < -0.6) {
        offset.set(withTiming(-160, { duration: 160 }, (finished) => {
          if (finished) scheduleOnRN(close);
        }));
      } else {
        offset.set(withSpring(0, { damping: 18, stiffness: 240 }));
      }
    },
    onTerminate: () => offset.set(withSpring(0)),
  });

  const dragStyle = useAnimatedStyle(() => ({ transform: [{ translateY: offset.get() }] }));

  // Layout animations (enter/exit/reorder) and the swipe transform live on separate views: a layout
  // animation owns `transform` on its view and would overwrite (and warn about) the drag offset.
  return (
    <Animated.View
      entering={FadeInUp.springify().damping(18)}
      exiting={FadeOutUp.duration(180)}
      layout={LinearTransition.springify().damping(20)}
      style={styles.cardWrapper}
    >
      <Animated.View style={dragStyle} {...panHandlers}>
        <Pressable
          accessibilityRole={toast.onPress ? 'button' : 'alert'}
          accessibilityLabel={toast.message ? `${toast.title}. ${toast.message}` : toast.title}
          accessibilityLiveRegion="polite"
          onPress={() => {
            if (toast.onPress) {
              beforeAction?.();
              toast.onPress();
            }
            close();
          }}
          style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
        >
          <View style={[styles.iconCircle, { backgroundColor: tone.bg }]}>
            <Icon name={toast.icon ?? TONE_ICONS[toast.tone ?? 'neutral']} size={20} color={tone.fg} />
          </View>
          <View style={styles.texts}>
            <AppText variant="captionStrong" numberOfLines={2}>
              {toast.title}
            </AppText>
            {toast.message ? (
              <AppText variant="caption" color="secondary" numberOfLines={2}>
                {toast.message}
              </AppText>
            ) : null}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={t('a11y.dismiss')} hitSlop={12} onPress={close} style={styles.close}>
            <Icon name="close" size={16} color="muted" />
          </Pressable>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const useStyles = makeStyles((t) => ({
  host: {
    position: 'absolute',
    pointerEvents: 'box-none',
    start: t.spacing.md,
    end: t.spacing.md,
    alignItems: 'center',
    gap: t.spacing.sm,
    zIndex: 1000,
    elevation: 1000,
  },
  cardWrapper: {
    width: '100%',
    maxWidth: 560,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    paddingVertical: t.spacing.md,
    paddingStart: t.spacing.md,
    paddingEnd: t.spacing.sm,
    borderRadius: t.radii.lg,
    backgroundColor: t.colors.surfaceElevated,
    borderWidth: t.scheme === 'dark' ? 1 : 0,
    borderColor: t.colors.border,
    ...t.shadows.lg,
  },
  pressed: {
    backgroundColor: t.colors.surfacePressed,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: {
    flex: 1,
    gap: t.spacing.xxs,
  },
  close: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
