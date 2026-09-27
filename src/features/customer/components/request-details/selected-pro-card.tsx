import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { JobStatusBadge } from '@/components/jobs';
import { ProfessionalSummaryCard } from '@/components/professionals';
import { AppText, Button, ErrorState, KeyValueRow, PriceText, SkeletonCard } from '@/components/ui';
import { getJobActions } from '@/features/jobs/job-status-machine';
import { useFormatters } from '@/i18n/hooks';
import { routes } from '@/lib/routes';
import { makeStyles } from '@/theme';
import type { JobDetails } from '@/types/domain';

export interface SelectedProCardProps {
  job: JobDetails | undefined;
  error: unknown;
  loading: boolean;
  onRetry: () => void;
}

/** "Your professional": the hired pro, the appointment, the agreed price and quick actions. */
export function SelectedProCard({ job, error, loading, onRetry }: SelectedProCardProps) {
  const styles = useStyles();
  const router = useRouter();
  const { t } = useTranslation(['customer', 'common']);
  const format = useFormatters();

  if (!job) {
    if (loading) return <SkeletonCard lines={3} />;
    return <ErrorState compact error={error} onRetry={onRetry} />;
  }

  const actions = getJobActions(job, 'customer', { hasReview: Boolean(job.reviewId) });

  return (
    <View style={styles.section} testID="selected-pro">
      <View style={styles.titleBlock}>
        <AppText variant="title" accessibilityRole="header">
          {t('customer:details.yourPro')}
        </AppText>
        <JobStatusBadge status={job.status} size="sm" />
      </View>
      <ProfessionalSummaryCard
        professional={job.professional}
        highlightCategoryIds={[job.categoryId]}
        maxCategories={2}
        onPress={() => router.push(routes.professionalProfile(job.professional.id))}
        footer={
          <View style={styles.footer}>
            {job.status === 'completed' && job.completedAt ? (
              <KeyValueRow icon="calendar-check" label={t('common:jobStatus.completed')} value={format.dateTime(job.completedAt)} />
            ) : (
              <KeyValueRow icon="calendar-clock" label={t('customer:details.appointment')} value={format.dateTime(job.scheduledStartAt)} />
            )}
            {job.estimatedDurationMinutes ? (
              <KeyValueRow
                icon="timer-outline"
                label={t('customer:details.estimatedDuration')}
                value={format.duration(job.estimatedDurationMinutes)}
              />
            ) : null}
            <KeyValueRow
              icon="cash"
              label={t('customer:details.agreedPrice')}
              value={<PriceText amount={job.agreedPrice} currency={job.currency} variant="subheading" />}
            />
            <View style={styles.buttons}>
              <Button
                label={t('customer:details.viewJob')}
                leftIcon="briefcase-outline"
                variant="secondary"
                style={styles.flex}
                onPress={() => router.push(routes.job(job.id))}
                testID="selected-pro-view-job"
              />
              {actions.canMessage ? (
                <Button
                  label={t('common:actions.message')}
                  leftIcon="message-text-outline"
                  variant="outline"
                  style={styles.flex}
                  onPress={() => router.push(routes.conversation(job.conversationId))}
                  testID="selected-pro-message"
                />
              ) : null}
            </View>
            {actions.canReview ? (
              <Button
                label={t('customer:details.leaveReview')}
                leftIcon="star-outline"
                fullWidth
                onPress={() => router.push(routes.reviewJob(job.id))}
              />
            ) : null}
          </View>
        }
      />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  section: {
    gap: t.spacing.md,
  },
  titleBlock: {
    gap: t.spacing.xs,
  },
  flex: {
    flex: 1,
  },
  footer: {
    gap: t.spacing.xs,
  },
  buttons: {
    flexDirection: 'row',
    gap: t.spacing.sm,
    marginTop: t.spacing.sm,
  },
}));
