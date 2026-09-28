import type { StyleProp, ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { URGENCY_META, type UrgencyLevel } from '@/constants/urgency-levels';

import { Badge, type BadgeSize } from '../ui/badge';

interface UrgencyBadgeProps {
  level: UrgencyLevel;
  size?: BadgeSize;
  style?: StyleProp<ViewStyle>;
}

/** Urgency level as a text pill in its tone (`common:urgency.<level>.label`). */
export function UrgencyBadge({ level, size = 'md', style }: UrgencyBadgeProps) {
  const { t } = useTranslation('common');
  return (
    <Badge label={t(`urgency.${level}.label`)} tone={URGENCY_META[level].tone} size={size} style={style} testID={`urgency-badge-${level}`} />
  );
}
