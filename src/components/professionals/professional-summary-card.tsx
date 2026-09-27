import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useFormatters } from '@/i18n/hooks';
import { makeStyles } from '@/theme';
import type { CategoryId, ProfessionalSummary } from '@/types/domain';

import { CategoryChip } from '../categories/category-chip';
import { AppText } from '../ui/app-text';
import { Avatar } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import { Icon, type IconSource } from '../ui/icon';
import { RatingStars } from '../ui/rating';

export interface ProfessionalSummaryCardProps {
  professional: ProfessionalSummary;
  onPress?: () => void;
  /** Categories to show first (e.g. the request's category). */
  highlightCategoryIds?: readonly CategoryId[];
  /** Maximum category chips before "+n" (default 3). */
  maxCategories?: number;
  /** Hide the category chips entirely. */
  hideCategories?: boolean;
  distanceKm?: number | null;
  /** Extra content at the bottom (e.g. offer price and actions). */
  footer?: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Compact professional profile: avatar, name, verification, rating, experience and categories. */
export function ProfessionalSummaryCard({
  professional,
  onPress,
  highlightCategoryIds = [],
  maxCategories = 3,
  hideCategories = false,
  distanceKm,
  footer,
  style,
  testID,
}: ProfessionalSummaryCardProps) {
  const styles = useStyles();
  const { t } = useTranslation('common');
  const format = useFormatters();

  const orderedCategories = [
    ...highlightCategoryIds.filter((id) => professional.categoryIds.includes(id)),
    ...professional.categoryIds.filter((id) => !highlightCategoryIds.includes(id)),
  ];
  const visibleCategories = orderedCategories.slice(0, maxCategories);
  const hiddenCount = orderedCategories.length - visibleCategories.length;

  const stats: { icon: IconSource; label: string }[] = [
    { icon: 'briefcase-outline', label: t('pro.experienceYears', { count: professional.yearsOfExperience }) },
    { icon: 'check-decagram-outline', label: t('pro.jobsDone', { count: professional.completedJobsCount }) },
  ];
  if (typeof distanceKm === 'number') stats.push({ icon: 'map-marker-distance', label: format.distance(distanceKm, { away: true }) });

  return (
    <Card onPress={onPress} style={style} testID={testID} accessibilityLabel={onPress ? professional.displayName : undefined}>
      <View style={styles.header}>
        <Avatar name={professional.displayName} uri={professional.avatarUrl} size="lg" verified={professional.isVerified} decorative />
        <View style={styles.texts}>
          <View style={styles.nameRow}>
            <AppText variant="subheading" numberOfLines={2} style={styles.name}>
              {professional.displayName}
            </AppText>
            {professional.isVerified ? (
              <Badge label={t('verified')} tone="brand" icon="check-decagram" size="sm" style={styles.verified} />
            ) : null}
          </View>
          {professional.headline ? (
            <AppText variant="caption" color="secondary" numberOfLines={2}>
              {professional.headline}
            </AppText>
          ) : null}
          <RatingStars value={professional.averageRating} count={professional.reviewCount} showValue size={14} />
        </View>
        {onPress ? <Icon name="chevron-right" size={22} color="muted" flipInRTL /> : null}
      </View>

      <View style={styles.stats}>
        {stats.map((stat) => (
          <View key={stat.label} style={styles.stat}>
            <Icon name={stat.icon} size={15} color="muted" />
            <AppText variant="caption" color="secondary" numberOfLines={1}>
              {stat.label}
            </AppText>
          </View>
        ))}
        {professional.city ? (
          <View style={styles.stat}>
            <Icon name="map-marker-outline" size={15} color="muted" />
            <AppText variant="caption" color="secondary" numberOfLines={1}>
              {professional.city}
            </AppText>
          </View>
        ) : null}
      </View>

      {!hideCategories && visibleCategories.length > 0 ? (
        <View style={styles.categories}>
          {visibleCategories.map((id) => (
            <CategoryChip key={id} categoryId={id} size="sm" selected={highlightCategoryIds.includes(id)} />
          ))}
          {hiddenCount > 0 ? <Badge label={t('pro.moreCategories', { count: hiddenCount })} size="md" /> : null}
        </View>
      ) : null}

      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.spacing.md,
  },
  texts: {
    flex: 1,
    gap: t.spacing.xs,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  name: {
    flexShrink: 1,
  },
  // The name wraps to a second line instead; the badge keeps its full label.
  verified: {
    flexShrink: 0,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: t.spacing.lg,
    rowGap: t.spacing.xs,
    marginTop: t.spacing.md,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
  },
  categories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: t.spacing.sm,
    marginTop: t.spacing.md,
  },
  footer: {
    marginTop: t.spacing.lg,
    paddingTop: t.spacing.md,
    borderTopWidth: 1,
    borderTopColor: t.colors.border,
  },
}));
