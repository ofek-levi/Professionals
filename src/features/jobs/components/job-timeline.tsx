import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Icon, type IconName } from '@/components/ui';
import { useFormatters } from '@/i18n/hooks';
import { makeStyles, useTheme } from '@/theme';
import type { Job, UserRole } from '@/types/domain';

import { getJobTimeline, type JobTimelineStep, type JobTimelineStepState } from './job-view-model';

export interface JobTimelineProps {
  job: Pick<Job, 'status' | 'createdAt' | 'confirmedAt' | 'startedAt' | 'completedAt' | 'cancelledAt' | 'scheduledStartAt'>;
  role: UserRole;
  now: Date;
}

const STEP_ICONS: Partial<Record<JobTimelineStepState, IconName>> = {
  done: 'check',
  active: 'progress-wrench',
  skipped: 'minus',
  cancelled: 'close',
};

/** Vertical status timeline: Offer accepted → Appointment confirmed → In progress → Completed (or Cancelled). */
export function JobTimeline({ job, role, now }: JobTimelineProps) {
  const styles = useStyles();
  const steps = getJobTimeline(job);
  return (
    <View style={styles.list} accessibilityRole="list">
      {steps.map((step, index) => (
        <TimelineItem key={step.key} step={step} job={job} role={role} now={now} isLast={index === steps.length - 1} nextState={steps[index + 1]?.state} />
      ))}
    </View>
  );
}

function TimelineItem({
  step,
  job,
  role,
  now,
  isLast,
  nextState,
}: {
  step: JobTimelineStep;
  job: JobTimelineProps['job'];
  role: UserRole;
  now: Date;
  isLast: boolean;
  nextState: JobTimelineStepState | undefined;
}) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation(['jobs', 'common']);
  const format = useFormatters();

  const label = t(`details.timeline.steps.${step.key}`);
  // Screen readers get the state that sighted users read from color and icon.
  const stateLabel = t(`common:a11y.timelineStep.${STEP_A11Y_STATE[step.state]}`);
  let hint: string | null = step.at ? format.dateTime(step.at) : null;
  if (step.state === 'next') {
    if (step.key === 'confirmed') hint = t(`details.timeline.hints.confirmedNext.${role}`);
    else if (step.key === 'in_progress') hint = t('details.timeline.hints.inProgressNext', { date: format.dateTime(job.scheduledStartAt, { casing: 'inline' }) });
    else if (step.key === 'completed') hint = t('details.timeline.hints.completedNext');
  } else if (step.state === 'active' && step.at) {
    hint = t('details.timeline.hints.inProgressActive', { relative: format.relative(step.at, now, { casing: 'inline' }) });
  } else if (step.state === 'skipped') {
    hint = t('details.timeline.hints.skipped');
  }

  const tones = theme.colors.tones;
  const indicator = (() => {
    switch (step.state) {
      case 'done':
        return { background: tones.success.solid, border: tones.success.solid, icon: theme.colors.onPrimary };
      case 'active':
        return { background: tones.warning.solid, border: tones.warning.solid, icon: theme.colors.onPrimary };
      case 'cancelled':
        return { background: tones.danger.solid, border: tones.danger.solid, icon: theme.colors.onPrimary };
      case 'next':
        return { background: theme.colors.surface, border: theme.colors.primary, icon: theme.colors.primary };
      case 'skipped':
        return { background: theme.colors.surfaceMuted, border: theme.colors.border, icon: theme.colors.textMuted };
      case 'upcoming':
        return { background: theme.colors.surface, border: theme.colors.borderStrong, icon: theme.colors.textMuted };
    }
  })();
  const connectorDone = (step.state === 'done' || step.state === 'skipped') && nextState !== undefined && nextState !== 'upcoming';
  const emphasized = step.state === 'next' || step.state === 'active' || step.state === 'cancelled';

  return (
    <View style={styles.item} accessible accessibilityLabel={[label, stateLabel, hint].filter(Boolean).join(', ')}>
      <View style={styles.rail}>
        <View style={[styles.indicator, { backgroundColor: indicator.background, borderColor: indicator.border }]}>
          {STEP_ICONS[step.state] ? (
            <Icon name={STEP_ICONS[step.state] ?? 'check'} size={14} color={indicator.icon} />
          ) : step.state === 'next' ? (
            <View style={[styles.innerDot, { backgroundColor: theme.colors.primary }]} />
          ) : null}
        </View>
        {isLast ? null : <View style={[styles.connector, { backgroundColor: connectorDone ? tones.success.solid : theme.colors.border }]} />}
      </View>
      <View style={[styles.texts, isLast ? null : styles.textsSpacing]}>
        <AppText
          variant={emphasized ? 'bodyStrong' : 'body'}
          color={step.state === 'upcoming' || step.state === 'skipped' ? 'muted' : step.state === 'cancelled' ? 'danger' : 'default'}
        >
          {label}
        </AppText>
        {hint ? (
          <AppText variant="caption" color={step.state === 'next' ? 'primary' : 'muted'}>
            {hint}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const INDICATOR_SIZE = 24;

const STEP_A11Y_STATE: Record<JobTimelineStepState, 'done' | 'current' | 'next' | 'upcoming' | 'skipped' | 'cancelled'> = {
  done: 'done',
  active: 'current',
  next: 'next',
  upcoming: 'upcoming',
  skipped: 'skipped',
  cancelled: 'cancelled',
};

const useStyles = makeStyles((t) => ({
  list: {
    gap: 0,
  },
  item: {
    flexDirection: 'row',
    gap: t.spacing.md,
  },
  rail: {
    width: INDICATOR_SIZE,
    alignItems: 'center',
  },
  indicator: {
    width: INDICATOR_SIZE,
    height: INDICATOR_SIZE,
    borderRadius: INDICATOR_SIZE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  connector: {
    flex: 1,
    width: 2,
    minHeight: 16,
    marginVertical: t.spacing.xxs,
    borderRadius: 1,
  },
  texts: {
    flex: 1,
    gap: t.spacing.xxs,
    paddingTop: 1,
  },
  textsSpacing: {
    paddingBottom: t.spacing.lg,
  },
}));
