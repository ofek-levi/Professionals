/**
 * `/jobs/:jobId` – job tracking for both parties: status hero with timeline, appointment, price,
 * full address with map, the counterpart, the request and the review. The sticky footer holds the
 * next action for the viewer's role (from `getJobActions`) and the chat shortcut.
 */
import { useRouter } from 'expo-router';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ProfessionalSummaryCard } from '@/components/professionals';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  Screen,
  SectionHeader,
  useNow,
  type ButtonVariant,
  type IconSource,
} from '@/components/ui';
import { useSession } from '@/features/auth';
import { getJobActions } from '@/features/jobs/job-status-machine';
import { useJob, useRefetchOnFocus, useRouteParam } from '@/hooks';
import { routes } from '@/lib/routes';
import { makeStyles } from '@/theme';
import type { JobDetails, UserRole } from '@/types/domain';

import {
  AppointmentCard,
  CustomerCard,
  getCounterpartName,
  JobDetailsSkeleton,
  JobHeroCard,
  LocationCard,
  PriceCard,
  RequestSummaryCard,
} from '../components/job-cards';
import { JobReviewSection } from '../components/job-review-section';
import { planJobActions, type JobActionKey } from '../components/job-view-model';
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

  return <JobDetailsView job={query.data} role={role} refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />;
}

const ACTION_ICONS: Record<JobActionKey, IconSource> = {
  confirm: 'calendar-check',
  start: 'play-circle-outline',
  complete: 'check-decagram-outline',
  review: 'star-outline',
  cancel: 'close-circle-outline',
};

const PRIMARY_VARIANTS: Record<JobActionKey, ButtonVariant> = {
  confirm: 'primary',
  start: 'primary',
  complete: 'success',
  review: 'primary',
  cancel: 'danger',
};

function JobDetailsView({
  job,
  role,
  refreshing,
  onRefresh,
}: {
  job: JobDetails;
  role: UserRole;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const styles = useStyles();
  const router = useRouter();
  const { t } = useTranslation(['jobs', 'common']);
  const now = useNow(60_000);
  const actions = getJobActions(job, role, { hasReview: job.review !== null || job.reviewId !== null });
  const plan = planJobActions(job, role, actions);
  const runner = useJobActionRunner(job, role);
  const counterpartName = getCounterpartName(job, role);
  const busy = runner.pending !== null;

  const actionButton = (action: JobActionKey, variant: ButtonVariant, extra: { fullWidth?: boolean; style?: StyleProp<ViewStyle> } = {}) => (
    <Button
      key={action}
      label={t(`jobs:actions.${action}`)}
      leftIcon={ACTION_ICONS[action]}
      variant={variant}
      size="lg"
      loading={runner.pending === action}
      disabled={busy && runner.pending !== action}
      onPress={() => void runner.run(action)}
      testID={`job-action-${action}`}
      {...extra}
    />
  );

  const openChat = () => router.push(routes.conversation(job.conversationId));
  // With a primary action the chat shortcut is a compact icon button, so long labels fit.
  const messageButton = !plan.message ? null : plan.primary ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('jobs:actions.message')}
      onPress={openChat}
      style={({ pressed }) => [styles.messageIconButton, pressed ? styles.pressedSurface : null]}
      testID="job-action-message"
    >
      <Icon name="message-text-outline" size={24} color="primary" />
    </Pressable>
  ) : (
    <Button
      label={t('jobs:actions.message')}
      leftIcon="message-text-outline"
      size="lg"
      onPress={openChat}
      style={styles.flex}
      testID="job-action-message"
    />
  );

  const footer =
    plan.primary || messageButton ? (
      <View style={styles.footerRow}>
        {messageButton}
        {plan.primary ? actionButton(plan.primary, PRIMARY_VARIANTS[plan.primary], { style: styles.flex }) : null}
      </View>
    ) : undefined;

  const showNextStep = plan.secondary.length > 0;
  const nextStepText =
    role === 'customer' && job.status === 'scheduled'
      ? t('jobs:details.nextStep.customerScheduled')
      : plan.secondary.includes('cancel')
        ? t('jobs:details.nextStep.cancelHint')
        : null;

  return (
    <Screen edges={['left', 'right', 'bottom']} gap="lg" refreshing={refreshing} onRefresh={onRefresh} footer={footer} testID="job-details">
      <JobHeroCard job={job} role={role} now={now} />

      {showNextStep ? (
        <Card padding="lg" style={styles.nextStep} testID="job-next-step">
          <AppText variant="subheading">{t('jobs:details.nextStep.title')}</AppText>
          {nextStepText ? (
            <AppText variant="caption" color="secondary">
              {nextStepText}
            </AppText>
          ) : null}
          <View style={styles.secondaryActions}>
            {plan.secondary.map((action) =>
              action === 'cancel' ? (
                <Pressable
                  key={action}
                  accessibilityRole="button"
                  onPress={() => void runner.run(action)}
                  disabled={busy}
                  style={({ pressed }) => [styles.cancelLink, pressed ? styles.pressed : null]}
                  testID="job-action-cancel"
                >
                  <Icon name={ACTION_ICONS.cancel} size={20} color="danger" />
                  <AppText variant="bodyStrong" color="danger">
                    {t('jobs:actions.cancel')}
                  </AppText>
                </Pressable>
              ) : (
                actionButton(action, 'outline', { fullWidth: true })
              ),
            )}
          </View>
        </Card>
      ) : null}

      {role === 'customer' || job.status === 'completed' ? (
        <JobReviewSection
          job={job}
          role={role}
          canReview={actions.canReview}
          counterpartName={counterpartName}
          onLeaveReview={() => router.push(routes.reviewJob(job.id))}
        />
      ) : null}

      <View style={styles.section}>
        <AppointmentCard job={job} now={now} />
        <PriceCard job={job} onViewOffer={() => router.push(routes.offer(job.offerId))} />
      </View>

      <View>
        <SectionHeader title={t('jobs:details.location.title')} icon="map-marker-outline" />
        <LocationCard job={job} />
      </View>

      <View>
        <SectionHeader
          title={role === 'customer' ? t('jobs:details.counterpart.professional') : t('jobs:details.counterpart.customer')}
          icon={role === 'customer' ? 'account-hard-hat-outline' : 'account-outline'}
        />
        {role === 'customer' ? (
          <ProfessionalSummaryCard
            professional={job.professional}
            highlightCategoryIds={[job.categoryId]}
            onPress={() => router.push(routes.professionalProfile(job.professional.id))}
          />
        ) : (
          <CustomerCard job={job} />
        )}
      </View>

      <View>
        <SectionHeader title={t('jobs:details.request.title')} icon="clipboard-text-outline" />
        <RequestSummaryCard job={job} onViewRequest={() => router.push(routes.request(job.requestId))} />
      </View>
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
  messageIconButton: {
    width: 56,
    height: 56,
    borderRadius: t.radii.md,
    borderWidth: 1,
    borderColor: t.colors.borderStrong,
    backgroundColor: t.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressedSurface: {
    backgroundColor: t.colors.surfacePressed,
  },
  section: {
    gap: t.spacing.md,
  },
  nextStep: {
    gap: t.spacing.sm,
  },
  secondaryActions: {
    gap: t.spacing.sm,
    marginTop: t.spacing.xs,
  },
  cancelLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.spacing.sm,
    minHeight: 48,
    borderRadius: t.radii.md,
    borderWidth: 1,
    borderColor: t.colors.tones.danger.bg,
    backgroundColor: t.colors.dangerSoft,
  },
  pressed: {
    opacity: 0.7,
  },
}));
