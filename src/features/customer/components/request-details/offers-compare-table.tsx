import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Avatar, Button, Card, Icon, type IconName } from '@/components/ui';
import { isOfferExpired } from '@/features/offers/offer-status-machine';
import { useFormatters } from '@/i18n/hooks';
import { makeStyles, useTheme } from '@/theme';
import type { OfferWithProfessional } from '@/types/domain';

import { COMPARE_METRICS, getCompareBestIds, type CompareMetric } from '../../offer-comparison';

const LABEL_WIDTH = 108;
const COLUMN_WIDTH = 148;
const HEADER_HEIGHT = 104;
const ROW_HEIGHT = 52;
const ACTION_HEIGHT = 64;

const METRIC_ICONS: Record<CompareMetric, IconName> = {
  price: 'cash',
  start: 'calendar-clock',
  duration: 'timer-outline',
  rating: 'star-outline',
  reviews: 'comment-text-multiple-outline',
  experience: 'briefcase-outline',
  completedJobs: 'check-decagram-outline',
  distance: 'map-marker-distance',
};

export interface OffersCompareTableProps {
  offers: readonly OfferWithProfessional[];
  now: Date;
  canAccept: boolean;
  acceptingOfferId: string | null;
  onAccept: (offer: OfferWithProfessional) => void;
  onOpenProfessional: (offer: OfferWithProfessional) => void;
}

/** Pending offers side by side; the best value of each row is highlighted. */
export function OffersCompareTable({ offers, now, canAccept, acceptingOfferId, onAccept, onOpenProfessional }: OffersCompareTableProps) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation(['customer', 'common']);
  const format = useFormatters();
  const best = getCompareBestIds(offers);
  const dash = t('customer:offers.compare.unknown');

  const value = (offer: OfferWithProfessional, metric: CompareMetric): ReactNode => {
    const pro = offer.professional;
    switch (metric) {
      case 'price':
        return format.currency(offer.price, offer.currency);
      case 'start':
        return `${format.dayLabel(offer.proposedStartAt, now)}\n${format.time(offer.proposedStartAt)}`;
      case 'duration':
        return offer.estimatedDurationMinutes ? format.duration(offer.estimatedDurationMinutes, 'short') : dash;
      case 'rating':
        return pro.averageRating !== null && pro.reviewCount > 0 ? t('customer:offers.compare.ratingValue', { value: format.number(pro.averageRating, 1) }) : t('common:rating.new');
      case 'reviews':
        return format.number(pro.reviewCount);
      case 'experience':
        return t('customer:offers.compare.years', { count: pro.yearsOfExperience });
      case 'completedJobs':
        return format.number(pro.completedJobsCount);
      case 'distance':
        return typeof offer.distanceKm === 'number' ? format.distance(offer.distanceKm) : dash;
    }
  };

  return (
    <Card padding="none" style={styles.card} testID="offers-compare-table">
      <View style={styles.table}>
        <View style={[styles.labels, { borderEndColor: theme.colors.border }]}>
          <View style={[styles.cornerCell, { height: HEADER_HEIGHT }]}>
            <Icon name="compare-horizontal" size={22} color="muted" />
          </View>
          {COMPARE_METRICS.map((metric, index) => (
            <View
              key={metric}
              style={[styles.labelCell, index % 2 === 0 ? { backgroundColor: theme.colors.surfaceMuted } : null]}
            >
              <Icon name={METRIC_ICONS[metric]} size={15} color="muted" />
              <AppText variant="label" color="secondary" numberOfLines={2} style={styles.shrink}>
                {t(`customer:offers.compare.metrics.${metric}`)}
              </AppText>
            </View>
          ))}
          <View style={{ height: ACTION_HEIGHT }} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.flex}>
          {offers.map((offer) => {
            const pro = offer.professional;
            const expired = isOfferExpired(offer, now);
            return (
              <View key={offer.id} style={[styles.column, { borderEndColor: theme.colors.border }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('customer:offers.viewProfileA11y', { name: pro.displayName })}
                  onPress={() => onOpenProfessional(offer)}
                  style={({ pressed }) => [styles.headerCell, pressed ? styles.pressed : null]}
                >
                  <Avatar name={pro.displayName} uri={pro.avatarUrl} size="sm" verified={pro.isVerified} decorative />
                  <AppText variant="captionStrong" align="center" numberOfLines={2}>
                    {pro.displayName}
                  </AppText>
                </Pressable>
                {COMPARE_METRICS.map((metric, index) => {
                  const isBest = best[metric].has(offer.id);
                  return (
                    <View
                      key={metric}
                      style={[
                        styles.valueCell,
                        index % 2 === 0 ? { backgroundColor: theme.colors.surfaceMuted } : null,
                        isBest ? { backgroundColor: theme.colors.tones.success.bg } : null,
                      ]}
                    >
                      {isBest ? <Icon name="trophy-outline" size={13} color="success" /> : null}
                      <AppText
                        variant={isBest || metric === 'price' ? 'captionStrong' : 'caption'}
                        color={isBest ? 'success' : 'default'}
                        align="center"
                        numberOfLines={2}
                        tabular
                        style={styles.shrink}
                      >
                        {value(offer, metric)}
                      </AppText>
                    </View>
                  );
                })}
                <View style={styles.actionCell}>
                  {canAccept && !expired ? (
                    <Button
                      label={t('customer:offers.accept')}
                      variant="success"
                      size="sm"
                      fullWidth
                      loading={acceptingOfferId === offer.id}
                      disabled={acceptingOfferId !== null && acceptingOfferId !== offer.id}
                      onPress={() => onAccept(offer)}
                      testID={`compare-accept-${offer.id}`}
                    />
                  ) : null}
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>
      <View style={[styles.legend, { borderTopColor: theme.colors.border }]}>
        <Icon name="trophy-outline" size={14} color="success" />
        <AppText variant="caption" color="muted" style={styles.shrink}>
          {t('customer:offers.compare.legend')}
        </AppText>
      </View>
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  card: {
    overflow: 'hidden',
  },
  table: {
    flexDirection: 'row',
  },
  flex: {
    flex: 1,
  },
  labels: {
    width: LABEL_WIDTH,
    borderEndWidth: 1,
  },
  cornerCell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelCell: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
    paddingHorizontal: t.spacing.sm,
  },
  shrink: {
    flexShrink: 1,
  },
  column: {
    width: COLUMN_WIDTH,
    borderEndWidth: 1,
  },
  headerCell: {
    height: HEADER_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.spacing.xs,
    paddingHorizontal: t.spacing.sm,
  },
  pressed: {
    opacity: 0.7,
  },
  valueCell: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.spacing.xxs,
    paddingHorizontal: t.spacing.sm,
  },
  actionCell: {
    height: ACTION_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: t.spacing.sm,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm,
    borderTopWidth: 1,
  },
}));
