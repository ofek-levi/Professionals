import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { APP_CONFIG } from '@/constants/app-config';
import { useCategoryName, useFormatters } from '@/i18n/hooks';
import { makeStyles } from '@/theme';
import type { CustomerRequestView, ProfessionalRequestView, ServiceLocation } from '@/types/domain';

import { CategoryIcon } from '../categories/category-icon';
import { OfferStatusBadge } from '../offers/offer-status-badge';
import { AppText } from '../ui/app-text';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import { Icon } from '../ui/icon';
import { Divider } from '../ui/layout';
import { Skeleton } from '../ui/skeleton';
import { DistanceText, PriceText, TimeAgo } from '../ui/value-text';
import { PreferredScheduleText } from './preferred-schedule-text';
import { RequestStatusBadge, UrgencyBadge } from './status-badges';

interface RequestCardBaseProps {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export interface CustomerRequestCardProps extends RequestCardBaseProps {
  variant: 'customer';
  request: CustomerRequestView;
  /** Highlight unseen offers (computed by the caller, e.g. `latestOfferAt` > last visit). */
  hasNewOffers?: boolean;
}

export interface ProfessionalRequestCardProps extends RequestCardBaseProps {
  variant: 'professional';
  request: ProfessionalRequestView;
}

export type RequestCardProps = CustomerRequestCardProps | ProfessionalRequestCardProps;

/** "Neighborhood, City" (either part may be missing). */
export function formatAreaLabel(location: Pick<ServiceLocation, 'neighborhood' | 'city'>): string {
  return [location.neighborhood, location.city].filter(Boolean).join(', ');
}

/** Request summary for lists. `customer` = owner view, `professional` = job explorer view. */
export function RequestCard(props: RequestCardProps) {
  const { request, onPress, style, testID } = props;
  const styles = useStyles();
  const { t } = useTranslation('common');
  const format = useFormatters();
  const categoryName = useCategoryName(request.categoryId) || t('category.unknown');
  const area = formatAreaLabel(request.location);
  const highlighted = props.variant === 'customer' && Boolean(props.hasNewOffers);
  const offersLabel = request.offerCount > 0 ? t('counts.offers', { count: request.offerCount }) : t('request.noOffersYet');

  const a11yLabel = [
    categoryName,
    t(`urgency.${request.urgency}.label`),
    props.variant === 'customer' ? t(`requestStatus.${request.status}`) : format.distance(props.request.distanceKm, { away: true }),
    area,
    offersLabel,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Card
      onPress={onPress}
      highlighted={highlighted}
      style={style}
      testID={testID}
      accessibilityLabel={a11yLabel}
      padding="none"
    >
      <View style={styles.body}>
        <View style={styles.header}>
          <CategoryIcon categoryId={request.categoryId} size="md" />
          <View style={styles.headerTexts}>
            <AppText variant="subheading" numberOfLines={1}>
              {categoryName}
            </AppText>
            <TimeAgo date={request.publishedAt ?? request.createdAt} />
          </View>
          {props.variant === 'customer' ? (
            <RequestStatusBadge status={request.status} size="sm" />
          ) : (
            <UrgencyBadge level={request.urgency} size="sm" />
          )}
        </View>

        <AppText variant="body" color="secondary" numberOfLines={2}>
          {request.description}
        </AppText>

        <View style={styles.meta}>
          {props.variant === 'professional' ? <DistanceText km={props.request.distanceKm} away /> : null}
          {area ? (
            <View style={styles.metaItem}>
              <Icon name={request.location.isApproximate ? 'map-marker-radius-outline' : 'map-marker-outline'} size={16} color="secondary" />
              <AppText variant="caption" color="secondary" numberOfLines={1} style={styles.shrink}>
                {area}
              </AppText>
            </View>
          ) : null}
          {props.variant === 'customer' ? <UrgencyBadge level={request.urgency} size="sm" /> : null}
          {props.variant === 'professional' && request.preferredSchedule ? (
            <PreferredScheduleText schedule={request.preferredSchedule} />
          ) : null}
        </View>
      </View>

      <Divider />

      <View style={styles.footer}>
        <View style={styles.metaItem}>
          <Icon name="tag-multiple-outline" size={16} color={request.offerCount > 0 ? 'primary' : 'muted'} />
          <AppText variant="captionStrong" color={request.offerCount > 0 ? 'primary' : 'muted'}>
            {offersLabel}
          </AppText>
          {request.photos.length > 0 ? (
            <View style={[styles.metaItem, styles.photos]}>
              <Icon name="image-multiple-outline" size={15} color="muted" />
              <AppText variant="caption" color="muted" tabular>
                {request.photos.length}
              </AppText>
            </View>
          ) : null}
        </View>

        {props.variant === 'customer' ? (
          <View style={styles.footerEnd}>
            {props.request.lowestOfferPrice !== null && request.offerCount > 0 ? (
              <AppText variant="captionStrong" color="default" tabular>
                {t('request.lowestOffer', { price: format.currency(props.request.lowestOfferPrice, APP_CONFIG.defaultCurrency) })}
              </AppText>
            ) : null}
            {highlighted ? <Badge label={t('request.newOffers')} tone="brand" variant="solid" size="sm" dot /> : null}
          </View>
        ) : props.request.myOffer ? (
          <View style={styles.footerEnd}>
            <AppText variant="caption" color="muted">
              {t('request.yourOffer')}
            </AppText>
            <PriceText amount={props.request.myOffer.price} currency={props.request.myOffer.currency} variant="captionStrong" />
            <OfferStatusBadge status={props.request.myOffer.status} size="sm" withIcon={false} />
          </View>
        ) : null}
      </View>
    </Card>
  );
}

/** Placeholder with the exact RequestCard layout. */
export function RequestCardSkeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  return (
    <Card padding="none" style={style}>
      <View style={styles.body}>
        <View style={styles.header}>
          <Skeleton width={44} height={44} radius={12} />
          <View style={[styles.headerTexts, styles.skeletonTexts]}>
            <Skeleton width="60%" height={14} />
            <Skeleton width="30%" height={11} />
          </View>
          <Skeleton width={76} height={22} radius={999} />
        </View>
        <View style={styles.skeletonTexts}>
          <Skeleton width="100%" height={12} />
          <Skeleton width="75%" height={12} />
        </View>
        <View style={styles.meta}>
          <Skeleton width={110} height={16} />
          <Skeleton width={70} height={20} radius={999} />
        </View>
      </View>
      <Divider />
      <View style={styles.footer}>
        <Skeleton width={80} height={14} />
        <Skeleton width={64} height={14} />
      </View>
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  body: {
    padding: t.spacing.lg,
    gap: t.spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
  },
  headerTexts: {
    flex: 1,
    gap: t.spacing.xxs,
  },
  skeletonTexts: {
    gap: t.spacing.sm,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: t.spacing.md,
    rowGap: t.spacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
    flexShrink: 1,
  },
  shrink: {
    flexShrink: 1,
  },
  photos: {
    marginStart: t.spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: t.spacing.md,
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.md,
  },
  footerEnd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    flexShrink: 1,
  },
}));
