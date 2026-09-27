/** A job in the professional's jobs tab; jobs awaiting confirmation get an inline confirm bar. */
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { JobCard } from '@/components/jobs';
import { AppText, Button, Icon, useConfirm, useErrorText, useToast } from '@/components/ui';
import { getJobActions } from '@/features/jobs/job-status-machine';
import { useConfirmJob } from '@/hooks';
import { useFormatters } from '@/i18n/hooks';
import { makeStyles } from '@/theme';
import type { JobSummary } from '@/types/domain';

export interface ProJobItemProps {
  job: JobSummary;
  onPress: () => void;
}

export function ProJobItem({ job, onPress }: ProJobItemProps) {
  const styles = useStyles();
  const { t } = useTranslation('professional');
  const format = useFormatters();
  const confirm = useConfirm();
  const toast = useToast();
  const errorText = useErrorText();
  const confirmJob = useConfirmJob();
  const actions = getJobActions(job, 'professional', { hasReview: job.reviewId !== null });

  if (!actions.canConfirm) return <JobCard job={job} viewerRole="professional" onPress={onPress} testID={`pro-job-${job.id}`} />;

  const when = format.dateTime(job.scheduledStartAt);
  const onConfirm = async () => {
    const ok = await confirm({
      title: t('jobs.confirmDialog.title'),
      message: t('jobs.confirmDialog.message', { customer: job.customer.displayName, when }),
      confirmLabel: t('jobs.confirmDialog.confirm'),
      icon: 'calendar-check-outline',
      tone: 'success',
    });
    if (!ok) return;
    confirmJob.mutate(job.id, {
      onSuccess: () => toast.show({ title: t('jobs.confirmed'), message: t('jobs.confirmedMessage'), tone: 'success', icon: 'calendar-check' }),
      onError: (error) => toast.show({ ...errorText(error), tone: 'danger' }),
    });
  };

  return (
    <View style={styles.wrapper} testID={`pro-job-${job.id}`}>
      <View style={styles.bar}>
        <Icon name="calendar-alert" size={20} color="warning" />
        <View style={styles.texts}>
          <AppText variant="captionStrong" color="warning">
            {t('jobs.awaitingTitle')}
          </AppText>
          <AppText variant="caption" color="secondary">
            {t('jobs.awaitingDescription', { customer: job.customer.displayName })}
          </AppText>
        </View>
      </View>
      <JobCard job={job} viewerRole="professional" onPress={onPress} />
      <View style={styles.actions}>
        <Button
          label={t('jobs.confirmAppointment')}
          variant="success"
          leftIcon="calendar-check"
          loading={confirmJob.isPending}
          onPress={() => void onConfirm()}
          fullWidth
          testID={`pro-job-confirm-${job.id}`}
        />
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  wrapper: {
    borderRadius: t.radii.lg + 2,
    borderWidth: 1.5,
    borderColor: t.colors.tones.warning.solid,
    backgroundColor: t.colors.tones.warning.bg,
    overflow: 'hidden',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm + 2,
  },
  texts: {
    flex: 1,
    gap: t.spacing.xxs,
  },
  actions: {
    padding: t.spacing.md,
  },
}));
