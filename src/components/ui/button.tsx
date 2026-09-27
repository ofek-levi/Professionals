import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { makeStyles, useTheme, type Theme, type TypographyVariant } from '@/theme';

import { AppText } from './app-text';
import { haptics } from './haptics';
import { Icon, type IconSource } from './icon';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style' | 'disabled'> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner, keeps the width and blocks presses. */
  loading?: boolean;
  disabled?: boolean;
  leftIcon?: IconSource;
  rightIcon?: IconSource;
  /** Mirror the icons in RTL (use for arrows/chevrons). */
  flipIconsInRTL?: boolean;
  fullWidth?: boolean;
  /** `pill` for fully rounded CTAs. */
  shape?: 'rounded' | 'pill';
  /** Light haptic on press (native only). Defaults to `true`. */
  haptic?: boolean;
  /** Lines the label may wrap to before truncating (default 1). */
  labelLines?: number;
  style?: StyleProp<ViewStyle>;
}

interface VariantColors {
  background: string;
  pressedBackground: string;
  foreground: string;
  border: string;
}

function variantColors(theme: Theme, variant: ButtonVariant): VariantColors {
  const { colors } = theme;
  switch (variant) {
    case 'primary':
      return { background: colors.primary, pressedBackground: colors.primaryPressed, foreground: colors.onPrimary, border: colors.primary };
    case 'secondary':
      return { background: colors.primarySoft, pressedBackground: colors.surfacePressed, foreground: colors.primary, border: colors.primarySoft };
    case 'outline':
      return { background: colors.surface, pressedBackground: colors.surfacePressed, foreground: colors.text, border: colors.borderStrong };
    case 'ghost':
      return { background: 'transparent', pressedBackground: colors.surfacePressed, foreground: colors.primary, border: 'transparent' };
    case 'danger':
      return { background: colors.danger, pressedBackground: colors.tones.danger.fg, foreground: colors.onPrimary, border: colors.danger };
    case 'success':
      return { background: colors.success, pressedBackground: colors.tones.success.fg, foreground: colors.onPrimary, border: colors.success };
  }
}

/** Per-size metrics (also used by layouts that need to predict whether a label fits). */
export const BUTTON_SIZE_TOKENS: Record<ButtonSize, { height: number; paddingX: number; icon: number; text: TypographyVariant; gap: number }> = {
  sm: { height: 36, paddingX: 14, icon: 16, text: 'captionStrong', gap: 6 },
  md: { height: 48, paddingX: 18, icon: 20, text: 'bodyStrong', gap: 8 },
  lg: { height: 56, paddingX: 22, icon: 22, text: 'subheading', gap: 10 },
};

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  flipIconsInRTL = false,
  fullWidth = false,
  shape = 'rounded',
  haptic = true,
  labelLines = 1,
  style,
  onPress,
  accessibilityLabel,
  ...rest
}: ButtonProps) {
  const theme = useTheme();
  const styles = useStyles();
  const colors = variantColors(theme, variant);
  const tokens = BUTTON_SIZE_TOKENS[size];
  const inactive = disabled || loading;
  // Small buttons keep a 44pt touch target through hit slop.
  const slop = Math.max(0, Math.ceil((theme.layout.minTouchSize - tokens.height) / 2));

  const handlePress = (event: GestureResponderEvent) => {
    if (inactive) return;
    if (haptic) haptics.light();
    onPress?.(event);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      hitSlop={slop > 0 ? slop : undefined}
      onPress={handlePress}
      {...rest}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: tokens.height,
          paddingHorizontal: tokens.paddingX,
          borderRadius: shape === 'pill' ? theme.radii.pill : size === 'sm' ? theme.radii.sm : theme.radii.md,
          backgroundColor: pressed && !inactive ? colors.pressedBackground : colors.background,
          borderColor: colors.border,
        },
        fullWidth ? styles.fullWidth : styles.inline,
        pressed && !inactive ? styles.pressed : null,
        disabled && !loading ? styles.disabled : null,
        style,
      ]}
    >
      <View style={[styles.content, { gap: tokens.gap }, loading ? styles.hidden : null]}>
        {leftIcon ? <Icon name={leftIcon} size={tokens.icon} color={colors.foreground} flipInRTL={flipIconsInRTL} /> : null}
        <AppText variant={tokens.text} color={colors.foreground} numberOfLines={labelLines} align="center" style={styles.label}>
          {label}
        </AppText>
        {rightIcon ? <Icon name={rightIcon} size={tokens.icon} color={colors.foreground} flipInRTL={flipIconsInRTL} /> : null}
      </View>
      {loading ? (
        <View style={styles.spinner}>
          <ActivityIndicator size="small" color={colors.foreground} />
        </View>
      ) : null}
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  base: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inline: {
    alignSelf: 'flex-start',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flexShrink: 1,
  },
  hidden: {
    opacity: 0,
  },
  spinner: {
    ...StyleSheet.absoluteFill,
    pointerEvents: 'none',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: t.scheme === 'dark' ? 0.4 : 0.45,
  },
}));
