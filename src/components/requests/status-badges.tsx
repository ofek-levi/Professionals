import type { StyleProp, ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { REQUEST_STATUS_META, type RequestStatus } from '@/constants/request-statuses';
import { URGENCY_META, type UrgencyLevel } from '@/constants/urgency-levels';

import { Badge, type BadgeSize, type BadgeVariant } from '../ui/badge';

export interface UrgencyBadgeProps {
  level: UrgencyLevel;
  size?: BadgeSize;
  variant?: BadgeVariant;
  style?: StyleProp<ViewStyle>;
}

/** Urgency level with its icon and tone (`common:urgency.<level>.label`). */
export function UrgencyBadge({ level, size = 'md', variant = 'soft', style }: UrgencyBadgeProps) {
  const { t } = useTranslation('common');
  const meta = URGENCY_META[level];
  return (
    <Badge
      label={t(`urgency.${level}.label`)}
      tone={meta.tone}
      icon={meta.icon}
      size={size}
      variant={variant}
      style={style}
      testID={`urgency-badge-${level}`}
    />
  );
}

export interface RequestStatusBadgeProps {
  status: RequestStatus;
  size?: BadgeSize;
  /** Show the status icon (default `true`). */
  withIcon?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Marketplace status of a request (`common:requestStatus.<status>`). */
export function RequestStatusBadge({ status, size = 'md', withIcon = true, style }: RequestStatusBadgeProps) {
  const { t } = useTranslation('common');
  const meta = REQUEST_STATUS_META[status];
  return (
    <Badge
      label={t(`requestStatus.${status}`)}
      tone={meta.tone}
      icon={withIcon ? meta.icon : undefined}
      dot={!withIcon}
      size={size}
      style={style}
      testID={`request-status-${status}`}
    />
  );
}
