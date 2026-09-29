import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useFormatters } from '@/i18n/hooks';
import type { TypographyVariant } from '@/theme';
import type { PreferredSchedule } from '@/types/domain';

import { AppText } from '../ui/app-text';
import type { ColorProp } from '../ui/colors';

interface PreferredScheduleTextProps {
  schedule: PreferredSchedule;
  variant?: TypographyVariant;
  color?: ColorProp;
  style?: StyleProp<ViewStyle>;
}

/** The customer's preferred appointment date + time window: "Sun, Sep 27 · Morning (8:00–12:00)". */
export function PreferredScheduleText({ schedule, variant = 'caption', color = 'secondary', style }: PreferredScheduleTextProps) {
  const { t } = useTranslation('common');
  const formatters = useFormatters();
  const date = formatters.dateLabel(schedule.date, { preset: 'short' });
  const text = t('schedule.dateWithWindow', { date, window: t(`timeWindow.${schedule.timeWindow}`) });

  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>
      <AppText variant={variant} color={color} numberOfLines={1} style={{ flexShrink: 1 }}>
        {text}
      </AppText>
    </View>
  );
}
