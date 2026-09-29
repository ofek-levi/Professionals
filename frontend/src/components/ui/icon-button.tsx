import { ActivityIndicator, Pressable, type GestureResponderEvent, type StyleProp, type ViewStyle } from 'react-native';

import type { StatusTone } from '@/constants/tones';
import { makeStyles, useTheme, type Theme } from '@/theme';

import { resolveColor, type ColorProp } from './colors';
import { haptics } from './haptics';
import { Icon, type IconSource } from './icon';

type IconButtonVariant = 'plain' | 'soft' | 'filled' | 'surface';
type IconButtonSize = 'sm' | 'md' | 'lg';

interface IconButtonProps {
  icon: IconSource;
  /** Required: icon-only controls must be labelled for screen readers. */
  accessibilityLabel: string;
  onPress?: (event: GestureResponderEvent) => void;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  /** Tone for `soft`/`filled` variants (defaults to the brand/primary color). */
  tone?: StatusTone;
  /** Icon color override for `plain`/`surface`. */
  color?: ColorProp;
  flipInRTL?: boolean;
  disabled?: boolean;
  loading?: boolean;
  haptic?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const SIZES: Record<IconButtonSize, { box: number; icon: number }> = {
  sm: { box: 32, icon: 18 },
  md: { box: 40, icon: 22 },
  lg: { box: 48, icon: 24 },
};

function colorsFor(theme: Theme, variant: IconButtonVariant, tone: StatusTone | undefined, color: ColorProp | undefined) {
  const toneColors = tone ? theme.colors.tones[tone] : null;
  switch (variant) {
    case 'filled':
      return {
        background: toneColors?.solid ?? theme.colors.primaryFill,
        pressed: toneColors?.fg ?? theme.colors.primaryFillPressed,
        foreground: theme.colors.onPrimary,
        border: 'transparent',
      };
    case 'soft':
      return {
        background: toneColors?.bg ?? theme.colors.primarySoft,
        pressed: theme.colors.surfacePressed,
        foreground: toneColors?.fg ?? theme.colors.primary,
        border: 'transparent',
      };
    case 'surface':
      return {
        background: theme.colors.surface,
        pressed: theme.colors.surfacePressed,
        foreground: resolveColor(theme, color),
        border: 'transparent',
      };
    case 'plain':
      return {
        background: 'transparent',
        pressed: theme.colors.surface,
        foreground: resolveColor(theme, color),
        border: 'transparent',
      };
  }
}

export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  variant = 'plain',
  size = 'md',
  tone,
  color,
  flipInRTL = false,
  disabled = false,
  loading = false,
  haptic = true,
  accessibilityHint,
  style,
  testID,
}: IconButtonProps) {
  const theme = useTheme();
  const styles = useStyles();
  const { box, icon: iconSize } = SIZES[size];
  const palette = colorsFor(theme, variant, tone, color);
  const slop = Math.max(0, Math.ceil((theme.layout.minTouchSize - box) / 2));
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      hitSlop={slop > 0 ? slop : undefined}
      onPress={(event) => {
        if (haptic) haptics.light();
        onPress?.(event);
      }}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        {
          width: box,
          height: box,
          borderRadius: theme.radii.pill,
          backgroundColor: pressed ? palette.pressed : palette.background,
          borderColor: palette.border,
        },
        pressed ? styles.pressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={palette.foreground} />
      ) : (
        <Icon name={icon} size={iconSize} color={palette.foreground} flipInRTL={flipInRTL} />
      )}
    </Pressable>
  );
}

const useStyles = makeStyles(() => ({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.4,
  },
}));
