import type { ReactNode } from 'react';
import { Pressable, View, type AccessibilityRole, type GestureResponderEvent, type StyleProp, type ViewStyle } from 'react-native';

import { makeStyles, type Theme } from '@/theme';

import { haptics } from './haptics';

type CardPadding = keyof Theme['spacing'] | 'none';

interface CardProps {
  children: ReactNode;
  /**
   * Inner padding token. Defaults to `lg`. Padding set in `style` (e.g. `paddingHorizontal`) always
   * wins over the token, on every platform.
   */
  padding?: CardPadding;
  /** Makes the whole card pressable with pressed feedback. */
  onPress?: (event: GestureResponderEvent) => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: AccessibilityRole;
  /** Primary border (e.g. the selected or accepted item). */
  highlighted?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Content group: a softly filled, rounded surface with no border or shadow (cards never float).
 * Pressable cards dim slightly when pressed.
 */
export function Card({
  children,
  padding = 'lg',
  onPress,
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
  const containerStyle = [styles.base, paddingStyles[padding], highlighted ? styles.highlighted : null];

  if (!onPress) {
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
        onPress(event);
      }}
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
  highlighted: {
    borderColor: t.colors.primary,
  },
  pressed: {
    backgroundColor: t.colors.surfacePressed,
  },
  disabled: {
    opacity: 0.5,
  },
}));
