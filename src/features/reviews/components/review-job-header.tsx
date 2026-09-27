import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CategoryIcon, CategoryName } from '@/components/categories';
import { AppText, Avatar, Badge, Card, Skeleton } from '@/components/ui';
import { useFormatters } from '@/i18n/hooks';
import { makeStyles } from '@/theme';
import type { JobDetails } from '@/types/domain';

/** Who and what is being reviewed: professional avatar and name, job category and date. */
export function ReviewJobHeader({ job }: { job: JobDetails }) {
  const styles = useStyles();
  const { t } = useTranslation(['reviews', 'common']);
  const format = useFormatters();
  const { professional } = job;
  const jobDate = job.completedAt ?? job.scheduledStartAt;

  return (
    <Card padding="lg" testID="review-job-header">
      <View style={styles.row}>
        <Avatar name={professional.displayName} uri={professional.avatarUrl} size="lg" verified={professional.isVerified} decorative />
        <View style={styles.texts}>
          <View style={styles.nameRow}>
            <AppText variant="subheading" numberOfLines={1} style={styles.name}>
              {professional.displayName}
            </AppText>
            {professional.isVerified ? <Badge label={t('common:verified')} tone="brand" icon="check-decagram" size="sm" /> : null}
          </View>
          <View style={styles.inline}>
            <CategoryIcon categoryId={job.categoryId} size="xs" />
            <CategoryName categoryId={job.categoryId} variant="caption" color="secondary" numberOfLines={1} style={styles.name} />
          </View>
          <AppText variant="caption" color="muted">
            {t('reviews:create.jobDate', { date: format.date(jobDate, 'medium') })}
          </AppText>
        </View>
      </View>
    </Card>
  );
}

export function ReviewJobHeaderSkeleton() {
  const styles = useStyles();
  return (
    <Card padding="lg">
      <View style={styles.row}>
        <Skeleton circle height={64} />
        <View style={[styles.texts, styles.skeletonTexts]}>
          <Skeleton width="55%" height={16} />
          <Skeleton width="40%" height={12} />
          <Skeleton width="30%" height={11} />
        </View>
      </View>
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.lg,
  },
  texts: {
    flex: 1,
    gap: t.spacing.xs,
  },
  skeletonTexts: {
    gap: t.spacing.sm,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  name: {
    flexShrink: 1,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
  },
}));
