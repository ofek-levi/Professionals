import { View, type StyleProp, type ViewStyle } from 'react-native';

import type { StatusTone } from '@/constants/tones';
import { makeStyles, useTheme } from '@/theme';

import { AppText } from './app-text';
import { Icon, type IconSource } from './icon';

export type BadgeSize = 'sm' | 'md';
export type BadgeVariant = 'soft' | 'solid' | 'outline';

export interface BadgeProps {
  label: string;
  tone?: StatusTone;
  icon?: IconSource;
  size?: BadgeSize;
  variant?: BadgeVariant;
  /** Leading status dot instead of an icon. */
  dot?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Compact status/label pill. Never interactive. */
export function Badge({ label, tone = 'neutral', icon, size = 'md', variant = 'soft', dot = false, style, testID }: BadgeProps) {
  const theme = useTheme();
  const styles = useStyles();
  const colors = theme.colors.tones[tone];
  const foreground = variant === 'solid' ? theme.colors.onPrimary : colors.fg;
  const small = size === 'sm';

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
      style={[
        styles.base,
        small ? styles.small : styles.medium,
        variant === 'solid'
          ? { backgroundColor: colors.solid, borderColor: colors.solid }
          : variant === 'outline'
            ? { backgroundColor: 'transparent', borderColor: colors.fg }
            : { backgroundColor: colors.bg, borderColor: colors.bg },
        style,
      ]}
    >
      {dot ? <View style={[styles.dot, { backgroundColor: variant === 'solid' ? foreground : colors.solid }]} /> : null}
      {icon && !dot ? <Icon name={icon} size={small ? 12 : 14} color={foreground} /> : null}
      <AppText variant={small ? 'tiny' : 'label'} color={foreground} numberOfLines={1} maxFontSizeMultiplier={1.3}>
        {label}
      </AppText>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: t.radii.pill,
    borderWidth: 1,
    flexShrink: 1,
  },
  small: {
    paddingHorizontal: t.spacing.sm,
    paddingVertical: t.spacing.xxs,
    gap: t.spacing.xs,
  },
  medium: {
    paddingHorizontal: t.spacing.md - 2,
    paddingVertical: t.spacing.xs,
    gap: t.spacing.xs + 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
}));
