/**
 * Gradient hero with this month's earnings, rating and completed jobs, plus three tappable
 * counters (nearby open jobs, pending offers, active jobs).
 */
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Icon, Skeleton, withAlpha, type IconSource } from '@/components/ui';
import { useFormatters } from '@/i18n/hooks';
import { makeStyles, useTheme } from '@/theme';
import type { ProfessionalDashboard } from '@/types/api';
import type { ProfessionalStats } from '@/types/domain';

export interface PerformanceCardProps {
  dashboard: ProfessionalDashboard;
  stats: ProfessionalStats | undefined;
  onOpenExplore: () => void;
  onOpenOffers: () => void;
  onOpenJobs: () => void;
}

export function PerformanceCard({ dashboard, stats, onOpenExplore, onOpenOffers, onOpenJobs }: PerformanceCardProps) {
  const styles = useStyles();
  const theme = useTheme();
  const { t } = useTranslation(['professional', 'common']);
  const format = useFormatters();
  const rating = stats?.averageRating ?? null;

  return (
    <View style={styles.wrapper}>
      <LinearGradient colors={theme.colors.proGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.flex}>
            <AppText variant="captionStrong" color={withAlpha(theme.colors.onPrimary, 0.8)}>
              {t('professional:home.stats.earningsThisMonth')}
            </AppText>
            <AppText variant="display" color="onPrimary" tabular numberOfLines={1} testID="pro-home-earnings">
              {format.currency(dashboard.earningsThisMonth.amount, dashboard.earningsThisMonth.currency)}
            </AppText>
          </View>
          <View style={styles.ratingBox} accessible accessibilityLabel={rating !== null ? t('common:a11y.rating', { value: format.number(rating, 1) }) : t('common:rating.noReviews')}>
            <Icon name="star" size={18} color={theme.colors.star} />
            <AppText variant="heading" color="onPrimary" tabular>
              {rating !== null ? format.number(rating, 1) : t('common:rating.new')}
            </AppText>
          </View>
        </View>
        <View style={styles.heroBottom}>
          <HeroFact icon="check-decagram-outline" label={t('professional:home.stats.completedJobs', { count: dashboard.completedJobsCount })} />
          {stats ? <HeroFact icon="comment-quote-outline" label={t('common:counts.reviews', { count: stats.reviewCount })} /> : null}
        </View>
      </LinearGradient>

      <View style={styles.tiles}>
        <MiniStat
          icon="map-search-outline"
          tone="brand"
          value={dashboard.nearbyOpenRequestsCount}
          label={t('professional:home.stats.nearbyJobs')}
          onPress={onOpenExplore}
          testID="pro-home-stat-nearby"
        />
        <MiniStat
          icon="timer-sand"
          tone="info"
          value={dashboard.pendingOffersCount}
          label={t('professional:home.stats.pendingOffers')}
          onPress={onOpenOffers}
          testID="pro-home-stat-offers"
        />
        <MiniStat
          icon="briefcase-outline"
          tone="accent"
          value={dashboard.activeJobsCount}
          label={t('professional:home.stats.activeJobs')}
          onPress={onOpenJobs}
          testID="pro-home-stat-jobs"
        />
      </View>
    </View>
  );
}

function HeroFact({ icon, label }: { icon: IconSource; label: string }) {
  const styles = useStyles();
  const theme = useTheme();
  return (
    <View style={styles.fact}>
      <Icon name={icon} size={15} color={withAlpha(theme.colors.onPrimary, 0.85)} />
      <AppText variant="captionStrong" color={withAlpha(theme.colors.onPrimary, 0.9)} numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

function MiniStat({
  icon,
  tone,
  value,
  label,
  onPress,
  testID,
}: {
  icon: IconSource;
  tone: 'brand' | 'info' | 'accent';
  value: number;
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  const styles = useStyles();
  const theme = useTheme();
  const colors = theme.colors.tones[tone];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}`}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.tile, pressed ? styles.tilePressed : null]}
    >
      <View style={[styles.tileIcon, { backgroundColor: colors.bg }]}>
        <Icon name={icon} size={18} color={colors.fg} />
      </View>
      <AppText variant="title" tabular numberOfLines={1}>
        {value}
      </AppText>
      <AppText variant="caption" color="secondary" numberOfLines={2}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function PerformanceCardSkeleton() {
  const styles = useStyles();
  return (
    <View style={styles.wrapper}>
      <Skeleton height={150} radius={20} />
      <View style={styles.tiles}>
        {[0, 1, 2].map((index) => (
          <View key={index} style={styles.tile}>
            <Skeleton width={34} height={34} radius={10} />
            <Skeleton width="40%" height={22} />
            <Skeleton width="80%" height={12} />
          </View>
        ))}
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  wrapper: {
    gap: t.spacing.md,
  },
  hero: {
    borderRadius: t.radii.xl,
    padding: t.spacing.xl,
    gap: t.spacing.lg,
    overflow: 'hidden',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.spacing.md,
  },
  flex: {
    flex: 1,
    gap: t.spacing.xxs,
  },
  ratingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm,
    borderRadius: t.radii.pill,
    backgroundColor: withAlpha(t.colors.onPrimary, 0.16),
  },
  heroBottom: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.spacing.lg,
  },
  fact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
  },
  tiles: {
    flexDirection: 'row',
    gap: t.spacing.sm,
  },
  tile: {
    flex: 1,
    gap: t.spacing.xs,
    padding: t.spacing.md,
    borderRadius: t.radii.lg,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  tilePressed: {
    backgroundColor: t.colors.surfacePressed,
  },
  tileIcon: {
    width: 34,
    height: 34,
    borderRadius: t.radii.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: t.spacing.xxs,
  },
}));
