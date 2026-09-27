import type { StyleProp, ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Badge, useNow, type BadgeSize } from '@/components/ui';
import { useFormatters } from '@/i18n/hooks';
import type { ISODateTimeString } from '@/types/domain';

import { expiryTone, getExpiryCountdown, roundCountdownMinutes } from './offer-display';

export interface ExpiryBadgeProps {
  expiresAt: ISODateTimeString;
  size?: BadgeSize;
  /** `badge` (default) or plain colored caption text (`style` applies to the badge only). */
  variant?: 'badge' | 'text';
  style?: StyleProp<ViewStyle>;
}

/** Live countdown of a pending offer ("Expires in 3h 15m"), colored by how close it is. */
export function ExpiryBadge({ expiresAt, size = 'sm', variant = 'badge', style }: ExpiryBadgeProps) {
  const { t } = useTranslation('offers');
  const format = useFormatters();
  const now = useNow(30_000);
  const countdown = getExpiryCountdown(expiresAt, now);
  const tone = expiryTone(countdown);

  let label: string;
  if (countdown.state === 'expired') {
    label = t('expiry.expired');
  } else {
    const rounded = roundCountdownMinutes(countdown.minutesLeft);
    const time =
      rounded.unit === 'days' ? t('expiry.days', { count: Math.round(rounded.minutes / (24 * 60)) }) : format.duration(rounded.minutes, 'short');
    label = t('expiry.expiresIn', { time });
  }

  if (variant === 'text') {
    return (
      <AppText variant="captionStrong" color={tone} numberOfLines={1}>
        {label}
      </AppText>
    );
  }
  return <Badge label={label} tone={tone} icon={countdown.state === 'expired' ? 'clock-alert-outline' : 'timer-sand'} size={size} style={style} />;
}
