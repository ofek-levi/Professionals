import type { ReactNode } from 'react';
import { Pressable, View, type AccessibilityRole, type GestureResponderEvent, type StyleProp, type ViewStyle } from 'react-native';

import { makeStyles, type Theme } from '@/theme';

import { haptics } from './haptics';

export type CardVariant = 'elevated' | 'outlined' | 'flat';
export type CardPadding = keyof Theme['spacing'] | 'none';

export interface CardProps {
  children: ReactNode;
  variant?: CardVariant;
  /**
   * Inner padding token. Defaults to `lg`. Padding set in `style` (e.g. `paddingHorizontal`) always
   * wins over the token, on every platform.
   */
  padding?: CardPadding;
  /** Makes the whole card pressable with pressed feedback. */
  onPress?: (event: GestureResponderEvent) => void;
  onLongPress?: (event: GestureResponderEvent) => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: AccessibilityRole;
  /** Highlighted border (e.g. selected state or "new" items). */
  highlighted?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Surface container. Elevated cards use a soft shadow in light mode and a border in dark mode. */
export function Card({
  children,
  variant = 'elevated',
  padding = 'lg',
  onPress,
  onLongPress,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole,
  highlighted = false,
  disabled = false,
  style,
  testID,
}: CardProps) {
  const styles = useStyles();
  const paddingStyles = usePaddingStyles();
  // The token padding is a compiled style (not an inline object): on web an inline `padding` would
  // beat compiled longhands such as `paddingHorizontal` from the caller's `style`.
  const containerStyle = [styles.base, styles[variant], paddingStyles[padding], highlighted ? styles.highlighted : null];

  if (!onPress && !onLongPress) {
    return (
      <View style={[containerStyle, style]} testID={testID} accessibilityLabel={accessibilityLabel}>
        {children}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole={accessibilityRole ?? 'button'}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={(event) => {
        haptics.light();
        onPress?.(event);
      }}
      onLongPress={onLongPress}
      testID={testID}
      style={({ pressed }) => [containerStyle, pressed ? styles.pressed : null, disabled ? styles.disabled : null, style]}
    >
      {children}
    </Pressable>
  );
}

const usePaddingStyles = makeStyles(
  (t) =>
    ({
      none: {},
      xxs: { padding: t.spacing.xxs },
      xs: { padding: t.spacing.xs },
      sm: { padding: t.spacing.sm },
      md: { padding: t.spacing.md },
      lg: { padding: t.spacing.lg },
      xl: { padding: t.spacing.xl },
      xxl: { padding: t.spacing.xxl },
      xxxl: { padding: t.spacing.xxxl },
      huge: { padding: t.spacing.huge },
      screen: { padding: t.spacing.screen },
    }) satisfies Record<CardPadding, ViewStyle>,
);

const useStyles = makeStyles((t) => ({
  base: {
    borderRadius: t.radii.lg,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  elevated: {
    ...(t.scheme === 'dark' ? { borderColor: t.colors.border } : t.shadows.md),
  },
  outlined: {
    borderColor: t.colors.border,
  },
  flat: {
    backgroundColor: t.colors.surfaceMuted,
  },
  highlighted: {
    borderColor: t.colors.primary,
    borderWidth: 1.5,
  },
  pressed: {
    backgroundColor: t.colors.surfacePressed,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.5,
  },
}));
