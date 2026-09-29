import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useJobWhen } from '@/components/jobs';
import { AppText, Icon, Skeleton, haptics } from '@/components/ui';
import { useCategoryName } from '@/i18n/hooks';
import { makeStyles } from '@/theme';
import type { Job } from '@/types/domain';

interface JobContextBannerProps {
  job: Pick<Job, 'categoryId' | 'status' | 'scheduledStartAt' | 'completedAt'>;
  onPress: () => void;
}

/** One-line job context above the chat ("Plumbing · Tomorrow at 10:00") linking to the job. */
export function JobContextBanner({ job, onPress }: JobContextBannerProps) {
  const styles = useStyles();
  const { t } = useTranslation(['messaging', 'common']);
  const categoryName = useCategoryName(job.categoryId) || t('common:category.unknown');
  const { text: when } = useJobWhen(job);
  const cancelled = job.status === 'cancelled';
  const detail = cancelled ? t('common:jobStatus.cancelled') : when;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[categoryName, detail].join(', ')}
      accessibilityHint={t('messaging:chat.a11y.jobDetails')}
      onPress={() => {
        haptics.light();
        onPress();
      }}
      style={({ pressed }) => [styles.banner, pressed ? styles.pressed : null]}
      testID="chat-job-banner"
    >
      <View style={styles.texts}>
        <AppText variant="captionStrong" numberOfLines={1} style={styles.noShrink}>
          {categoryName}
        </AppText>
        <AppText variant="caption" color={cancelled ? 'danger' : 'secondary'} numberOfLines={1} style={styles.shrink}>
          {`· ${detail}`}
        </AppText>
      </View>
      <AppText variant="captionStrong" color="primary">
        {t('messaging:chat.viewJob')}
      </AppText>
      <Icon name="chevron-right" size={16} color="primary" flipInRTL />
    </Pressable>
  );
}

export function JobContextBannerSkeleton() {
  const styles = useStyles();
  return (
    <View style={styles.banner}>
      <Skeleton width="55%" height={12} />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
    paddingHorizontal: t.spacing.screen,
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
    backgroundColor: t.colors.background,
  },
  pressed: {
    opacity: 0.6,
  },
  texts: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
  },
  noShrink: {
    flexShrink: 0,
    maxWidth: '60%',
  },
  shrink: {
    flexShrink: 1,
  },
}));
