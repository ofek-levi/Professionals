import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useFormatters } from '@/i18n/hooks';
import { makeStyles, useTheme } from '@/theme';
import { RATING_VALUES, type RatingBreakdown } from '@/types/domain';

import { AppText } from '../ui/app-text';
import { Icon } from '../ui/icon';
import { RatingStars } from '../ui/rating';

export interface RatingSummaryProps {
  breakdown: RatingBreakdown;
  style?: StyleProp<ViewStyle>;
}

/** Big average score + star distribution bars (5 → 1). */
export function RatingSummary({ breakdown, style }: RatingSummaryProps) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation('common');
  const format = useFormatters();
  const { averageRating, reviewCount, distribution } = breakdown;
  const max = Math.max(1, ...RATING_VALUES.map((value) => distribution[value] ?? 0));

  return (
    <View style={[styles.container, style]}>
      <View style={styles.score}>
        <AppText variant="display" tabular accessibilityRole="header">
          {averageRating ? format.number(averageRating, 1) : '–'}
        </AppText>
        <RatingStars value={averageRating} size={16} />
        <AppText variant="caption" color="muted" align="center">
          {reviewCount > 0 ? t('rating.basedOn', { count: reviewCount }) : t('rating.noReviews')}
        </AppText>
      </View>
      <View style={styles.bars}>
        {[...RATING_VALUES].reverse().map((value) => {
          const count = distribution[value] ?? 0;
          const ratio = reviewCount > 0 ? count / max : 0;
          return (
            <View
              key={value}
              style={styles.barRow}
              accessible
              accessibilityLabel={`${t('rating.stars', { count: value })}: ${t('counts.reviews', { count })}`}
            >
              <AppText variant="label" color="secondary" tabular style={styles.barLabel}>
                {value}
              </AppText>
              <Icon name="star" size={12} color={theme.colors.star} />
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.round(ratio * 100)}%` }]} />
              </View>
              <AppText variant="label" color="muted" tabular align="end" style={styles.barCount}>
                {format.number(count)}
              </AppText>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xl,
  },
  score: {
    alignItems: 'center',
    gap: t.spacing.xs,
    minWidth: 104,
  },
  bars: {
    flex: 1,
    gap: t.spacing.xs + 2,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs + 2,
  },
  barLabel: {
    width: 10,
  },
  track: {
    flex: 1,
    height: 8,
    borderRadius: t.radii.pill,
    backgroundColor: t.colors.surfaceMuted,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: t.radii.pill,
    backgroundColor: t.colors.star,
  },
  barCount: {
    minWidth: 28,
  },
}));
