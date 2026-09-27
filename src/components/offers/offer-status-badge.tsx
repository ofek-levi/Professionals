import type { StyleProp, ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { OFFER_STATUS_META, type OfferStatus } from '@/constants/offer-statuses';

import { Badge, type BadgeSize } from '../ui/badge';

export interface OfferStatusBadgeProps {
  status: OfferStatus;
  size?: BadgeSize;
  withIcon?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Offer status (`common:offerStatus.<status>`) with its tone and icon. */
export function OfferStatusBadge({ status, size = 'md', withIcon = true, style }: OfferStatusBadgeProps) {
  const { t } = useTranslation('common');
  const meta = OFFER_STATUS_META[status];
  return (
    <Badge
      label={t(`offerStatus.${status}`)}
      tone={meta.tone}
      icon={withIcon ? meta.icon : undefined}
      dot={!withIcon}
      size={size}
      style={style}
      testID={`offer-status-${status}`}
    />
  );
}
