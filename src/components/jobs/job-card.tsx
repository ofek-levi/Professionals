import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { JOB_STATUS_META, type JobStatus } from '@/constants/job-statuses';
import { useCategoryName, useFormatters } from '@/i18n/hooks';
import { makeStyles } from '@/theme';
import type { JobSummary, UserRole } from '@/types/domain';

import { CategoryIcon } from '../categories/category-icon';
import { AppText } from '../ui/app-text';
import { Avatar } from '../ui/avatar';
import { Badge, type BadgeSize } from '../ui/badge';
import { Card } from '../ui/card';
import { Icon } from '../ui/icon';
import { Divider } from '../ui/layout';
import { Skeleton } from '../ui/skeleton';
import { PriceText } from '../ui/value-text';

export interface JobStatusBadgeProps {
  status: JobStatus;
  size?: BadgeSize;
  withIcon?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Job execution status (`common:jobStatus.<status>`). */
export function JobStatusBadge({ status, size = 'md', withIcon = true, style }: JobStatusBadgeProps) {
  const { t } = useTranslation('common');
  const meta = JOB_STATUS_META[status];
  return (
    <Badge
      label={t(`jobStatus.${status}`)}
      tone={meta.tone}
      icon={withIcon ? meta.icon : undefined}
      dot={!withIcon}
      size={size}
      style={style}
      testID={`job-status-${status}`}
    />
  );
}

export interface JobCardProps {
  job: JobSummary;
  /** Who is looking: the card shows the *other* party. */
  viewerRole: UserRole;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Job summary: category, description, counterpart, appointment, status and agreed price. */
export function JobCard({ job, viewerRole, onPress, style, testID }: JobCardProps) {
  const styles = useStyles();
  const { t } = useTranslation('common');
  const format = useFormatters();
  const categoryName = useCategoryName(job.categoryId) || t('category.unknown');
  const counterpart =
    viewerRole === 'customer'
      ? { name: job.professional.displayName, avatarUrl: job.professional.avatarUrl, verified: job.professional.isVerified, role: t('roles.professional') }
      : { name: job.customer.displayName, avatarUrl: job.customer.avatarUrl, verified: false, role: t('roles.customer') };
  const when = format.dateTime(job.scheduledStartAt);
  const duration = job.estimatedDurationMinutes ? format.duration(job.estimatedDurationMinutes, 'short') : null;

  return (
    <Card
      onPress={onPress}
      padding="none"
      style={style}
      testID={testID}
      accessibilityLabel={[categoryName, t(`jobStatus.${job.status}`), counterpart.name, when].join(', ')}
    >
      <View style={styles.body}>
        <View style={styles.header}>
          <CategoryIcon categoryId={job.categoryId} size="md" />
          <View style={styles.flex}>
            {/* The badge follows the title and wraps under it when both do not fit on one line. */}
            <View style={styles.titleRow}>
              <AppText variant="subheading" numberOfLines={1} style={styles.flexShrink}>
                {categoryName}
              </AppText>
              <JobStatusBadge status={job.status} size="sm" style={styles.statusBadge} />
            </View>
            <AppText variant="caption" color="secondary" numberOfLines={2}>
              {job.description}
            </AppText>
          </View>
        </View>

        <View style={styles.when}>
          <Icon name="calendar-clock" size={18} color="primary" />
          <AppText variant="captionStrong" numberOfLines={1} style={styles.flexShrink}>
            {when}
          </AppText>
          {duration ? (
            <AppText variant="caption" color="muted" numberOfLines={1}>
              {`· ${duration}`}
            </AppText>
          ) : null}
        </View>
      </View>
      <Divider />
      <View style={styles.footer}>
        <Avatar name={counterpart.name} uri={counterpart.avatarUrl} size="sm" verified={counterpart.verified} decorative />
        <View style={styles.flex}>
          <AppText variant="captionStrong" numberOfLines={1}>
            {counterpart.name}
          </AppText>
          <AppText variant="tiny" color="muted" numberOfLines={1}>
            {counterpart.role}
          </AppText>
        </View>
        <PriceText amount={job.agreedPrice} currency={job.currency} variant="subheading" />
      </View>
    </Card>
  );
}

export function JobCardSkeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  return (
    <Card padding="none" style={style}>
      <View style={styles.body}>
        <View style={styles.header}>
          <Skeleton width={44} height={44} radius={12} />
          <View style={[styles.flex, styles.skeletonGap]}>
            <Skeleton width="55%" height={14} />
            <Skeleton width="85%" height={11} />
          </View>
          <Skeleton width={80} height={22} radius={999} />
        </View>
        <Skeleton width="50%" height={30} radius={10} />
      </View>
      <Divider />
      <View style={styles.footer}>
        <Skeleton circle height={36} />
        <View style={[styles.flex, styles.skeletonGap]}>
          <Skeleton width="40%" height={12} />
          <Skeleton width="25%" height={10} />
        </View>
        <Skeleton width={64} height={18} />
      </View>
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  body: {
    padding: t.spacing.lg,
    gap: t.spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.spacing.md,
  },
  flex: {
    flex: 1,
    gap: t.spacing.xxs,
  },
  flexShrink: {
    flexShrink: 1,
  },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: t.spacing.sm,
    rowGap: t.spacing.xs,
  },
  statusBadge: {
    alignSelf: 'center',
    flexShrink: 0,
  },
  skeletonGap: {
    gap: t.spacing.sm,
  },
  when: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: t.spacing.sm,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm,
    borderRadius: t.radii.md,
    backgroundColor: t.colors.primarySoft,
    maxWidth: '100%',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.md,
  },
}));
