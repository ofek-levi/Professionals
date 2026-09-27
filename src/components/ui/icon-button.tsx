import { ActivityIndicator, Pressable, View, type GestureResponderEvent, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { StatusTone } from '@/constants/tones';
import { makeStyles, useTheme, type Theme } from '@/theme';

import { AppText } from './app-text';
import { resolveColor, type ColorProp } from './colors';
import { haptics } from './haptics';
import { Icon, type IconSource } from './icon';

export type IconButtonVariant = 'plain' | 'soft' | 'filled' | 'surface' | 'outline';
export type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps {
  icon: IconSource;
  /** Required: icon-only controls must be labelled for screen readers. */
  accessibilityLabel: string;
  onPress?: (event: GestureResponderEvent) => void;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  /** Tone for `soft`/`filled` variants (defaults to the brand/primary color). */
  tone?: StatusTone;
  /** Icon color override for `plain`/`surface`/`outline`. */
  color?: ColorProp;
  /** Small counter bubble on the top-end corner (hidden when 0/undefined). */
  badgeCount?: number;
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
        background: toneColors?.solid ?? theme.colors.primary,
        pressed: toneColors?.fg ?? theme.colors.primaryPressed,
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
        border: theme.colors.border,
      };
    case 'outline':
      return {
        background: 'transparent',
        pressed: theme.colors.surfacePressed,
        foreground: resolveColor(theme, color),
        border: theme.colors.borderStrong,
      };
    case 'plain':
      return {
        background: 'transparent',
        pressed: theme.colors.surfacePressed,
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
  badgeCount,
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
  const { t } = useTranslation('common');
  const { box, icon: iconSize } = SIZES[size];
  const palette = colorsFor(theme, variant, tone, color);
  const slop = Math.max(0, Math.ceil((theme.layout.minTouchSize - box) / 2));
  const showBadge = typeof badgeCount === 'number' && badgeCount > 0;
  const inactive = disabled || loading;

  const label = showBadge ? `${accessibilityLabel}, ${t('a11y.unreadCount', { count: badgeCount })}` : accessibilityLabel;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
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
      {showBadge ? (
        <View style={styles.badge}>
          <AppText variant="tiny" color="onPrimary" align="center" maxFontSizeMultiplier={1.1} tabular>
            {badgeCount > 99 ? '99+' : String(badgeCount)}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  pressed: {
    transform: [{ scale: 0.94 }],
  },
  disabled: {
    opacity: 0.4,
  },
  badge: {
    position: 'absolute',
    pointerEvents: 'none',
    top: -4,
    end: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: t.spacing.xs,
    borderRadius: t.radii.pill,
    backgroundColor: t.colors.danger,
    borderWidth: 2,
    borderColor: t.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
