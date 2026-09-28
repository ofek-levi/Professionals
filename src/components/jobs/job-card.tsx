import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { JOB_STATUS_META, type JobStatus } from '@/constants/job-statuses';
import { useCategoryName, useFormatters } from '@/i18n/hooks';
import { makeStyles } from '@/theme';
import type { Job, JobSummary, UserRole } from '@/types/domain';

import { CategoryIcon } from '../categories/category-icon';
import { AppText } from '../ui/app-text';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import { Skeleton } from '../ui/skeleton';

/** Job execution status as a small text pill (`common:jobStatus.<status>`). */
function JobStatusBadge({ status }: { status: JobStatus }) {
  const { t } = useTranslation('common');
  return <Badge label={t(`jobStatus.${status}`)} tone={JOB_STATUS_META[status].tone} size="sm" testID={`job-status-${status}`} />;
}

interface JobWhen {
  /** The job is done: `text` is its completion time instead of the (possibly later) appointment. */
  completed: boolean;
  text: string;
}

/**
 * The time to show for a job: the appointment, or once completed when it was completed (a job can
 * finish before its planned appointment, so "Tomorrow at 09:00" would be misleading).
 */
export function useJobWhen(job: Pick<Job, 'status' | 'scheduledStartAt' | 'completedAt'>): JobWhen {
  const { t } = useTranslation('common');
  const format = useFormatters();
  if (job.status === 'completed' && job.completedAt) {
    return { completed: true, text: t('job.completedAt', { date: format.dateTime(job.completedAt, { casing: 'inline' }) }) };
  }
  return { completed: false, text: format.dateTime(job.scheduledStartAt) };
}

interface JobCardProps {
  job: JobSummary;
  /** Who is looking: the card shows the *other* party. */
  viewerRole: UserRole;
  /** Adds the agreed price after the date (off by default – cards show 3–4 facts). */
  showPrice?: boolean;
  /** Hides the status pill when the surrounding section already names the status ("Completed"). */
  showStatus?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Compact job summary: category, counterpart, appointment (or completion) time and a status pill. */
export function JobCard({ job, viewerRole, showPrice = false, showStatus = true, onPress, style, testID }: JobCardProps) {
  const styles = useStyles();
  const { t } = useTranslation('common');
  const format = useFormatters();
  const categoryName = useCategoryName(job.categoryId) || t('category.unknown');
  const counterpart = viewerRole === 'customer' ? job.professional.displayName : job.customer.displayName;
  const { completed, text: when } = useJobWhen(job);
  // The status pill already says "Completed", so the date line only shows when it happened.
  const whenLabel = completed && job.completedAt ? format.dateTime(job.completedAt) : when;
  const dateLine = showPrice ? `${whenLabel} · ${format.currency(job.agreedPrice, job.currency)}` : whenLabel;

  return (
    <Card
      onPress={onPress}
      padding="none"
      style={style}
      testID={testID}
      accessibilityLabel={[categoryName, t(`jobStatus.${job.status}`), counterpart, when].join(', ')}
    >
      <View style={styles.row}>
        <CategoryIcon categoryId={job.categoryId} size="sm" />
        <View style={styles.texts}>
          <View style={styles.titleRow}>
            <AppText variant="bodyStrong" numberOfLines={1} style={styles.flex}>
              {categoryName}
            </AppText>
            {showStatus ? <JobStatusBadge status={job.status} /> : null}
          </View>
          <AppText variant="caption" color="secondary" numberOfLines={1}>
            {counterpart}
          </AppText>
          <AppText variant="caption" color="muted" numberOfLines={1} tabular style={styles.when}>
            {dateLine}
          </AppText>
        </View>
      </View>
    </Card>
  );
}

export function JobCardSkeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  return (
    <Card padding="none" style={style}>
      <View style={styles.row}>
        <Skeleton width={36} height={36} radius={10} />
        <View style={[styles.texts, styles.skeletonGap]}>
          <View style={styles.titleRow}>
            <Skeleton width="45%" height={14} />
            <View style={styles.flex} />
            <Skeleton width={72} height={18} radius={999} />
          </View>
          <Skeleton width="40%" height={11} />
          <Skeleton width="55%" height={11} />
        </View>
      </View>
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.spacing.md,
    padding: t.spacing.lg,
  },
  texts: {
    flex: 1,
    gap: t.spacing.xxs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  flex: {
    flex: 1,
  },
  when: {
    marginTop: t.spacing.xxs,
  },
  skeletonGap: {
    gap: t.spacing.sm,
  },
}));
