import { View, type StyleProp, type ViewStyle } from 'react-native';

import type { StatusTone } from '@/constants/tones';
import { makeStyles, useTheme } from '@/theme';

import { AppText } from './app-text';

export type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  label: string;
  tone?: StatusTone;
  size?: BadgeSize;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Small text-only status/label pill on a soft tone background. Never interactive. */
export function Badge({ label, tone = 'neutral', size = 'md', style, testID }: BadgeProps) {
  const theme = useTheme();
  const styles = useStyles();
  const colors = theme.colors.tones[tone];
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
        // A transparent border: tone backgrounds are translucent in dark mode and would double up as a ring.
        { backgroundColor: colors.bg, borderColor: 'transparent' },
        style,
      ]}
    >
      <AppText variant={small ? 'tiny' : 'label'} color={colors.fg} numberOfLines={1} maxFontSizeMultiplier={1.3}>
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
    paddingVertical: 1,
    gap: t.spacing.xs,
  },
  medium: {
    paddingHorizontal: t.spacing.sm + 2,
    paddingVertical: t.spacing.xxs + 1,
    gap: t.spacing.xs,
  },
}));
