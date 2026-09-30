/**
 * `/jobs/:jobId` – job tracking for both parties: status with a slim progress indicator, the
 * counterpart, appointment, price and address, and the review once there is one. The sticky
 * footer holds the single next action for the viewer's role (from `getJobActions`) next to a
 * chat shortcut; less common actions are quiet text buttons.
 */
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ReviewCard } from '@/components/professionals';
import { AppText, BUTTON_SIZE_TOKENS, Button, EmptyState, ErrorState, IconButton, Screen } from '@/components/ui';
import { useSession } from '@/features/auth';
import { getJobActions } from '@/features/jobs/job-status-machine';
import { useJob, useRefetchOnFocus, useRouteParam } from '@/hooks';
import { routes } from '@/lib/routes';
import { makeStyles } from '@/theme';
import type { JobDetails, UserRole } from '@/types/domain';

import { CounterpartRow, JobDetailsSkeleton, JobInfoCard, JobStatusHeader, TextAction } from '../components/job-cards';
import { planJobActions } from '../components/job-view-model';
import { useJobActionRunner } from '../components/use-job-action-runner';

export default function JobDetailsScreen() {
  const { t } = useTranslation(['jobs', 'common']);
  const jobId = useRouteParam('jobId');
  const { role } = useSession();
  const query = useJob(jobId);
  useRefetchOnFocus(query.refetch);

  if (!jobId || !role) {
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        <EmptyState icon="briefcase-search-outline" title={t('jobs:details.notFoundTitle')} description={t('jobs:details.notFoundDescription')} />
      </Screen>
    );
  }

  if (query.data === undefined) {
    return (
      <Screen edges={['left', 'right', 'bottom']} testID="job-details-loading">
        {query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} retrying={query.isRefetching} />
        ) : (
          <JobDetailsSkeleton />
        )}
      </Screen>
    );
  }

  return <JobDetailsView job={query.data} role={role} onRefresh={() => query.refetch()} />;
}

function JobDetailsView({
  job,
  role,
  onRefresh,
}: {
  job: JobDetails;
  role: UserRole;
  onRefresh: () => Promise<unknown>;
}) {
  const styles = useStyles();
  const router = useRouter();
  const { t } = useTranslation(['jobs', 'common']);
  const actions = getJobActions(job, role, { hasReview: job.review !== null || job.reviewId !== null });
  const plan = planJobActions(job, role, actions);
  const runner = useJobActionRunner(job, role);
  const busy = runner.pending !== null;
  const openChat = () => router.push(routes.conversation(job.conversationId));

  const primary = plan.primary ? (
    <Button
      label={t(`jobs:actions.${plan.primary}`)}
      size="lg"
      loading={runner.pending === plan.primary}
      disabled={busy && runner.pending !== plan.primary}
      onPress={() => {
        if (plan.primary) void runner.run(plan.primary);
      }}
      style={styles.flex}
      testID={`job-action-${plan.primary}`}
    />
  ) : null;

  // The next action is the one loud element; without one, messaging stays available as a calm
  // secondary button instead of a primary that is not an action.
  const footer = primary ? (
    <View style={styles.footerRow}>
      {plan.message ? (
        <IconButton
          icon="message-text-outline"
          variant="soft"
          size="lg"
          accessibilityLabel={t('jobs:actions.message')}
          onPress={openChat}
          style={styles.messageButton}
          testID="job-action-message"
        />
      ) : null}
      {primary}
    </View>
  ) : plan.message ? (
    <Button
      label={t('jobs:actions.message')}
      variant="secondary"
      leftIcon="message-text-outline"
      fullWidth
      onPress={openChat}
      testID="job-action-message"
    />
  ) : undefined;

  return (
    <Screen edges={['left', 'right', 'bottom']} gap="xxl" onRefresh={onRefresh} footer={footer} testID="job-details">
      <JobStatusHeader job={job} role={role} />

      <View style={styles.group}>
        <CounterpartRow
          job={job}
          role={role}
          onPress={role === 'customer' ? () => router.push(routes.professionalProfile(job.professional.id)) : undefined}
        />
        <JobInfoCard job={job} />
        <TextAction
          label={t('jobs:details.request.viewRequest')}
          chevron
          onPress={() => router.push(routes.request(job.requestId))}
          testID="job-view-request"
        />
      </View>

      {job.review ? (
        <View style={styles.section}>
          <AppText variant="heading" accessibilityRole="header">
            {role === 'customer' ? t('jobs:details.review.customerTitle') : t('jobs:details.review.professionalTitle')}
          </AppText>
          {/* The section title and the counterpart row already say who wrote it. */}
          <ReviewCard review={job.review} hideAuthor />
        </View>
      ) : role === 'professional' && job.status === 'completed' ? (
        <AppText variant="caption" color="muted">
          {t('jobs:details.review.pendingProfessional')}
        </AppText>
      ) : null}

      {plan.secondary.length > 0 ? (
        <View style={styles.secondary}>
          {plan.secondary.map((action) => (
            <TextAction
              key={action}
              label={t(`jobs:actions.${action}`)}
              disabled={busy}
              onPress={() => void runner.run(action)}
              testID={`job-action-${action}`}
            />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  flex: {
    flex: 1,
  },
  footerRow: {
    flexDirection: 'row',
    gap: t.spacing.md,
  },
  messageButton: {
    width: BUTTON_SIZE_TOKENS.lg.height,
    height: BUTTON_SIZE_TOKENS.lg.height,
    borderRadius: BUTTON_SIZE_TOKENS.lg.radius,
  },
  group: {
    gap: t.spacing.md,
  },
  section: {
    gap: t.spacing.md,
  },
  secondary: {
    alignItems: 'center',
    gap: t.spacing.xs,
  },
}));
