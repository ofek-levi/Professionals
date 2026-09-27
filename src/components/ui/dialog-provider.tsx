import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import type { StatusTone } from '@/constants/tones';
import { makeStyles, useTheme } from '@/theme';

import { AppText } from './app-text';
import { Button } from './button';
import { haptics } from './haptics';
import { Icon, type IconSource } from './icon';

export interface ConfirmOptions {
  title: string;
  message?: string;
  /** Defaults to `common:actions.confirm`. */
  confirmLabel?: string;
  /** Defaults to `common:actions.cancel`; pass `null` for a single-button alert. */
  cancelLabel?: string | null;
  /** Red confirm button and warning icon. */
  destructive?: boolean;
  icon?: IconSource;
  tone?: StatusTone;
}

/** Opens a confirmation dialog and resolves `true` when confirmed, `false` otherwise. */
export type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

interface PendingDialog {
  id: number;
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
}

const DialogContext = createContext<ConfirmFn | null>(null);

let nextDialogId = 1;

/** Hosts the app-wide confirmation dialog. Mount once near the root (inside ThemeProvider + i18n). */
export function DialogProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<PendingDialog[]>([]);

  const confirm: ConfirmFn = (options) =>
    new Promise<boolean>((resolve) => {
      const id = nextDialogId++;
      setQueue((current) => [...current, { id, options, resolve }]);
    });

  const current = queue[0] ?? null;

  const settle = (result: boolean) => {
    if (!current) return;
    current.resolve(result);
    setQueue((items) => items.filter((item) => item.id !== current.id));
  };

  return (
    <DialogContext.Provider value={confirm}>
      {children}
      {current ? <ConfirmDialog key={current.id} options={current.options} onSettle={settle} /> : null}
    </DialogContext.Provider>
  );
}

const fallbackConfirm: ConfirmFn = async () => {
  if (__DEV__) console.warn('useConfirm() was called outside <DialogProvider>; resolving false.');
  return false;
};

/** `const confirm = useConfirm(); if (await confirm({ title, destructive: true })) …` */
export function useConfirm(): ConfirmFn {
  return useContext(DialogContext) ?? fallbackConfirm;
}

function ConfirmDialog({ options, onSettle }: { options: ConfirmOptions; onSettle: (result: boolean) => void }) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation('common');
  const progress = useSharedValue(0);
  const tone = theme.colors.tones[options.tone ?? (options.destructive ? 'danger' : 'brand')];
  const icon = options.icon ?? (options.destructive ? 'alert-outline' : 'help-circle-outline');
  const cancelLabel = options.cancelLabel === undefined ? t('actions.cancel') : options.cancelLabel;

  useEffect(() => {
    progress.set(withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) }));
    if (options.destructive) haptics.warning();
  }, [progress, options.destructive]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.get() }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ scale: 0.94 + progress.get() * 0.06 }],
  }));

  const dismiss = () => onSettle(false);

  return (
    <Modal transparent visible animationType="none" onRequestClose={dismiss} statusBarTranslucent navigationBarTranslucent>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} accessibilityRole="button" accessibilityLabel={t('a11y.close')} />
        </Animated.View>
        <Animated.View style={[styles.card, cardStyle]} accessibilityViewIsModal accessibilityRole="alert">
          <View style={[styles.iconCircle, { backgroundColor: tone.bg }]}>
            <Icon name={icon} size={28} color={tone.fg} />
          </View>
          <AppText variant="heading" align="center" accessibilityRole="header">
            {options.title}
          </AppText>
          {options.message ? (
            <AppText variant="body" color="secondary" align="center">
              {options.message}
            </AppText>
          ) : null}
          <View style={styles.actions}>
            {cancelLabel ? (
              <Button label={cancelLabel} variant="outline" onPress={dismiss} style={styles.action} fullWidth />
            ) : null}
            <Button
              label={options.confirmLabel ?? t('actions.confirm')}
              variant={options.destructive ? 'danger' : 'primary'}
              onPress={() => onSettle(true)}
              style={styles.action}
              fullWidth
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((t) => ({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: t.spacing.xxl,
  },
  backdrop: {
    backgroundColor: t.colors.overlay,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    gap: t.spacing.md,
    padding: t.spacing.xxl,
    borderRadius: t.radii.xl,
    backgroundColor: t.colors.surface,
    ...t.shadows.lg,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: t.spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: t.spacing.md,
    marginTop: t.spacing.sm,
  },
  action: {
    flex: 1,
  },
}));
