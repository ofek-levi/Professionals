import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useFormatters } from '@/i18n/hooks';
import { useTheme, type TypographyVariant } from '@/theme';
import type { PreferredSchedule } from '@/types/domain';

import { AppText } from '../ui/app-text';
import type { ColorProp } from '../ui/colors';
import { Icon } from '../ui/icon';

export interface PreferredScheduleTextProps {
  schedule: PreferredSchedule | null;
  /** `short`: "Tomorrow · Morning"; `full`: "Sun, Sep 27 · Morning (8:00–12:00)". */
  format?: 'short' | 'full';
  withIcon?: boolean;
  variant?: TypographyVariant;
  color?: ColorProp;
  numberOfLines?: number;
  style?: StyleProp<ViewStyle>;
}

/** The customer's preferred appointment date + time window ("Flexible date" when none). */
export function PreferredScheduleText({
  schedule,
  format = 'short',
  withIcon = true,
  variant = 'caption',
  color = 'secondary',
  numberOfLines = 1,
  style,
}: PreferredScheduleTextProps) {
  const theme = useTheme();
  const { t } = useTranslation('common');
  const formatters = useFormatters();

  let text: string;
  if (!schedule) {
    text = t('schedule.anyDate');
  } else {
    const date = format === 'short' ? formatters.dayLabel(schedule.date) : formatters.dateLabel(schedule.date, { preset: 'short' });
    const window = format === 'short' ? t(`timeWindowShort.${schedule.timeWindow}`) : t(`timeWindow.${schedule.timeWindow}`);
    text = t('schedule.dateWithWindow', { date, window });
  }

  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }, style]}>
      {withIcon ? <Icon name="calendar-blank-outline" size={16} color={color} /> : null}
      <AppText variant={variant} color={color} numberOfLines={numberOfLines} style={{ flexShrink: 1 }}>
        {text}
      </AppText>
    </View>
  );
}
