import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CategoryName } from '@/components/categories';
import { AppText, Avatar, Card, Icon, Skeleton, StatTile } from '@/components/ui';
import { useFormatters } from '@/i18n/hooks';
import { makeStyles, useTheme } from '@/theme';
import type { CustomerDashboard } from '@/types/api';
import type { CustomerRequestSection } from '@/constants/request-statuses';
import type { JobSummary } from '@/types/domain';
import { isolateText } from '@/utils/bidi';

// ─────────────────────────────── Offers attention ───────────────────────────────

export interface OffersAttentionCardProps {
  pendingOffersCount: number;
  requestsWithOffersCount: number;
  onPress: () => void;
}

/** "3 offers waiting for your decision" call to action. */
export function OffersAttentionCard({ pendingOffersCount, requestsWithOffersCount, onPress }: OffersAttentionCardProps) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation('customer');
  const tone = theme.colors.tones.brand;
  const title = t('home.attention.title', { count: pendingOffersCount });
  const subtitle = t('home.attention.subtitle', { count: requestsWithOffersCount });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}`}
      onPress={onPress}
      testID="home-offers-attention"
      style={({ pressed }) => [styles.attention, { backgroundColor: tone.bg, borderColor: tone.solid }, pressed ? styles.pressed : null]}
    >
      <View style={[styles.attentionIcon, { backgroundColor: tone.solid }]}>
        <Icon name="tag-multiple" size={22} color="onPrimary" />
        <View style={[styles.attentionCount, { borderColor: tone.bg }]}>
          <AppText variant="tiny" color="onPrimary" tabular>
            {pendingOffersCount}
          </AppText>
        </View>
      </View>
      <View style={styles.flex}>
        <AppText variant="bodyStrong" color={tone.fg}>
          {title}
        </AppText>
        <AppText variant="caption" color="secondary">
          {subtitle}
        </AppText>
      </View>
      <View style={[styles.attentionAction, { backgroundColor: tone.solid }]}>
        <AppText variant="label" color="onPrimary">
          {t('home.attention.action')}
        </AppText>
        <Icon name="chevron-right" size={16} color="onPrimary" flipInRTL />
      </View>
    </Pressable>
  );
}

// ─────────────────────────────── Summary tiles ───────────────────────────────

export interface SummaryTilesProps {
  dashboard: Pick<CustomerDashboard, 'openRequestsCount' | 'pendingOffersCount' | 'activeJobsCount'>;
  onOpenSection: (section: CustomerRequestSection | null) => void;
}

/** Open requests / offers waiting / active jobs. */
export function SummaryTiles({ dashboard, onOpenSection }: SummaryTilesProps) {
  const styles = useStyles();
  const { t } = useTranslation('customer');
  return (
    <View style={styles.tiles}>
      <StatTile
        icon="clipboard-text-clock-outline"
        tone="info"
        value={dashboard.openRequestsCount}
        label={t('home.summary.openRequests')}
        onPress={() => onOpenSection(null)}
        style={styles.tile}
      />
      <StatTile
        icon="tag-multiple-outline"
        tone="brand"
        value={dashboard.pendingOffersCount}
        label={t('home.summary.offersWaiting')}
        onPress={() => onOpenSection('has_offers')}
        style={styles.tile}
      />
      <StatTile
        icon="progress-wrench"
        tone="accent"
        value={dashboard.activeJobsCount}
        label={t('home.summary.activeJobs')}
        onPress={() => onOpenSection('active')}
        style={styles.tile}
      />
    </View>
  );
}

export function SummaryTilesSkeleton() {
  const styles = useStyles();
  return (
    <View style={styles.tiles}>
      {[0, 1, 2].map((index) => (
        <View key={index} style={[styles.tile, styles.tileSkeleton]}>
          <Skeleton width={32} height={32} radius={10} />
          <Skeleton width="40%" height={22} />
          <Skeleton width="80%" height={12} />
        </View>
      ))}
    </View>
  );
}

// ─────────────────────────────── Review prompt ───────────────────────────────

export interface ReviewPromptCardProps {
  job: JobSummary;
  onPress: () => void;
}

/** "How did {pro} do?" prompt for a completed job without a review. */
export function ReviewPromptCard({ job, onPress }: ReviewPromptCardProps) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation('customer');
  const format = useFormatters();
  const pro = job.professional;
  const title = t('home.review.title', { name: isolateText(pro.displayName) });

  return (
    <Card onPress={onPress} accessibilityLabel={title} padding="lg" testID={`home-review-${job.id}`}>
      <View style={styles.reviewRow}>
        <Avatar name={pro.displayName} uri={pro.avatarUrl} size="md" verified={pro.isVerified} decorative />
        <View style={styles.flex}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {title}
          </AppText>
          <View style={styles.reviewMeta}>
            <CategoryName categoryId={job.categoryId} variant="caption" color="secondary" numberOfLines={1} />
            {job.completedAt ? (
              <AppText variant="caption" color="muted" numberOfLines={1}>
                {`· ${format.dayLabel(job.completedAt)}`}
              </AppText>
            ) : null}
          </View>
        </View>
      </View>
      <View style={[styles.reviewCta, { backgroundColor: theme.colors.surfaceMuted }]}>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Icon key={star} name="star-outline" size={24} color={theme.colors.star} />
          ))}
        </View>
        <AppText variant="captionStrong" color="primary">
          {t('home.review.action')}
        </AppText>
      </View>
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  flex: {
    flex: 1,
    gap: t.spacing.xxs,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  attention: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    padding: t.spacing.lg,
    borderRadius: t.radii.lg,
    borderWidth: 1,
  },
  attentionIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attentionCount: {
    position: 'absolute',
    top: -4,
    end: -4,
    minWidth: 20,
    height: 20,
    paddingHorizontal: t.spacing.xs,
    borderRadius: t.radii.pill,
    borderWidth: 2,
    backgroundColor: t.colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attentionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xxs,
    paddingStart: t.spacing.md,
    paddingEnd: t.spacing.sm,
    minHeight: 32,
    borderRadius: t.radii.pill,
  },
  tiles: {
    flexDirection: 'row',
    gap: t.spacing.sm,
  },
  tile: {
    flex: 1,
    padding: t.spacing.md,
  },
  tileSkeleton: {
    gap: t.spacing.sm,
    padding: t.spacing.md,
    borderRadius: t.radii.lg,
    backgroundColor: t.colors.surface,
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
  },
  reviewMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
  },
  reviewCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: t.spacing.md,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm,
    borderRadius: t.radii.md,
  },
  stars: {
    flexDirection: 'row',
    gap: t.spacing.xxs,
  },
}));
