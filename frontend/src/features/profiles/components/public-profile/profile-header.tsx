import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Avatar, Badge, Icon, Skeleton } from '@/components/ui';
import { useFormatters } from '@/i18n/hooks';
import { makeStyles, useTheme } from '@/theme';
import type { ProfessionalProfile } from '@/types/domain';

const AVATAR_SIZE = 88;

/** Avatar, name, headline, verification and "★ 4.8 · 32 reviews · 120 jobs done". */
export function ProfileHeader({ profile }: { profile: ProfessionalProfile }) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation(['profile', 'common']);
  const format = useFormatters();
  const { averageRating, reviewCount, completedJobsCount } = profile.stats;
  const facts = [
    averageRating !== null ? t('common:counts.reviews', { count: reviewCount }) : t('common:rating.new'),
    t('common:pro.jobsDone', { count: completedJobsCount }),
  ];

  return (
    <View style={styles.container} testID="profile-header">
      <Avatar name={profile.displayName} uri={profile.avatarUrl} size={AVATAR_SIZE} />
      <View style={styles.names}>
        <AppText variant="title" align="center" accessibilityRole="header">
          {profile.displayName}
        </AppText>
        {profile.headline ? (
          <AppText variant="body" color="secondary" align="center" numberOfLines={2} style={styles.headline}>
            {profile.headline}
          </AppText>
        ) : null}
      </View>
      <View style={styles.meta}>
        {profile.isVerified ? <Badge label={t('common:verified')} tone="brand" size="sm" /> : null}
        <View style={styles.facts}>
          {averageRating !== null ? <Icon name="star" size={15} color={theme.colors.star} /> : null}
          <AppText variant="caption" color="secondary">
            {[averageRating !== null ? format.number(averageRating, 1) : null, ...facts].filter(Boolean).join(' · ')}
          </AppText>
        </View>
      </View>
    </View>
  );
}

export function ProfileHeaderSkeleton() {
  const styles = useStyles();
  return (
    <View style={styles.container}>
      <Skeleton circle height={AVATAR_SIZE} />
      <View style={[styles.names, styles.skeletonNames]}>
        <Skeleton width={180} height={22} />
        <Skeleton width={220} height={14} />
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  container: {
    alignItems: 'center',
    gap: t.spacing.md,
    paddingTop: t.spacing.sm,
  },
  names: {
    alignItems: 'center',
    gap: t.spacing.xs,
  },
  skeletonNames: {
    gap: t.spacing.sm,
  },
  headline: {
    maxWidth: 420,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  facts: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
  },
}));
