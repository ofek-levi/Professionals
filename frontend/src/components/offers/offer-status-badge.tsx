import type { StyleProp, ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { offerStatusMeta, type OfferStatus } from '@/constants/offer-statuses';

import { Badge, type BadgeSize } from '../ui/badge';

interface OfferStatusBadgeProps {
  status: OfferStatus;
  size?: BadgeSize;
  style?: StyleProp<ViewStyle>;
}

/** Offer status as a text pill in its tone (`common:offerStatus.<status>`). */
export function OfferStatusBadge({ status, size = 'md', style }: OfferStatusBadgeProps) {
  const { t } = useTranslation('common');
  return (
    <Badge label={t(`offerStatus.${status}`)} tone={offerStatusMeta(status).tone} size={size} style={style} testID={`offer-status-${status}`} />
  );
}
