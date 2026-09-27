import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CategoryIcon } from '@/components/categories';
import { JobStatusBadge, useJobWhen } from '@/components/jobs';
import { AppText, Icon, Skeleton, haptics } from '@/components/ui';
import { useCategoryName } from '@/i18n/hooks';
import { makeStyles } from '@/theme';
import type { Job } from '@/types/domain';

export interface JobContextBannerProps {
  job: Pick<Job, 'categoryId' | 'status' | 'scheduledStartAt' | 'completedAt'>;
  onPress: () => void;
}

/** Compact job summary pinned above the chat (category, status, appointment) linking to the job. */
export function JobContextBanner({ job, onPress }: JobContextBannerProps) {
  const styles = useStyles();
  const { t } = useTranslation(['messaging', 'common']);
  const categoryName = useCategoryName(job.categoryId) || t('common:category.unknown');
  const { completed, text: appointment } = useJobWhen(job);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[categoryName, t(`common:jobStatus.${job.status}`), appointment].join(', ')}
      accessibilityHint={t('messaging:chat.a11y.jobDetails')}
      onPress={() => {
        haptics.light();
        onPress();
      }}
      style={({ pressed }) => [styles.banner, pressed ? styles.pressed : null]}
      testID="chat-job-banner"
    >
      <CategoryIcon categoryId={job.categoryId} size="sm" />
      <View style={styles.texts}>
        <View style={styles.titleRow}>
          <AppText variant="captionStrong" numberOfLines={1} style={styles.flexShrink}>
            {categoryName}
          </AppText>
          <JobStatusBadge status={job.status} size="sm" withIcon={false} />
        </View>
        <View style={styles.dateRow}>
          <Icon name={completed ? 'calendar-check' : 'calendar-clock'} size={14} color="muted" />
          <AppText variant="caption" color="secondary" numberOfLines={1} style={styles.flexShrink}>
            {appointment}
          </AppText>
        </View>
      </View>
      <Icon name="chevron-right" size={20} color="muted" flipInRTL />
    </Pressable>
  );
}

export function JobContextBannerSkeleton() {
  const styles = useStyles();
  return (
    <View style={styles.banner}>
      <Skeleton width={36} height={36} radius={10} />
      <View style={[styles.texts, styles.skeletonTexts]}>
        <Skeleton width="50%" height={12} />
        <Skeleton width="35%" height={10} />
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.sm + 2,
    minHeight: 56,
    backgroundColor: t.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  pressed: {
    backgroundColor: t.colors.surfacePressed,
  },
  texts: {
    flex: 1,
    gap: t.spacing.xxs,
  },
  skeletonTexts: {
    gap: t.spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
  },
  flexShrink: {
    flexShrink: 1,
  },
}));
