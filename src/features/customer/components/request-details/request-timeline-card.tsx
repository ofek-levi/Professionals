import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Card, Icon, type IconName } from '@/components/ui';
import { useFormatters } from '@/i18n/hooks';
import { makeStyles, useTheme } from '@/theme';
import type { CustomerRequestView, JobDetails } from '@/types/domain';

import { buildRequestTimeline, type RequestTimelineStepKey, type TimelineStep } from '../../request-timeline';

const STEP_ICONS: Record<RequestTimelineStepKey | 'cancelled', IconName> = {
  published: 'send-check-outline',
  offers: 'tag-multiple-outline',
  selected: 'account-check-outline',
  scheduled: 'calendar-check-outline',
  in_progress: 'progress-wrench',
  completed: 'check-decagram-outline',
  cancelled: 'close-circle-outline',
};

export interface RequestTimelineCardProps {
  request: CustomerRequestView;
  job: JobDetails | null;
}

/** Vertical status progress: done steps, the step in progress and what comes next. */
export function RequestTimelineCard({ request, job }: RequestTimelineCardProps) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation(['customer', 'common']);
  const format = useFormatters();
  const steps = buildRequestTimeline(request, job);

  const caption = (step: TimelineStep): string | null => {
    if (step.key === 'cancelled') {
      const reason = request.cancellationReason
        ? t('customer:details.timeline.cancelReason', { reason: t(`common:cancellationReason.${request.cancellationReason}`) })
        : null;
      return [step.at ? format.dateTime(step.at) : null, reason].filter(Boolean).join(' · ');
    }
    if (step.state === 'current') {
      if (step.key === 'offers') return t('customer:details.timeline.current.offers');
      if (step.key === 'selected') return t('customer:details.timeline.current.selected', { count: request.pendingOfferCount });
      if (step.key === 'scheduled') return t('customer:details.timeline.current.scheduled');
      if (step.key === 'in_progress') {
        return job?.startedAt
          ? t('customer:details.timeline.current.inProgressStarted', { time: format.dateTime(job.startedAt) })
          : step.at
            ? t('customer:details.timeline.current.upcoming', { time: format.dateTime(step.at) })
            : null;
      }
    }
    if (step.state === 'done') {
      if (step.key === 'offers') return t('customer:details.timeline.offersReceived', { count: request.offerCount });
      if (step.key === 'selected' && job) return job.professional.displayName;
    }
    if (step.state === 'upcoming' && step.key === 'in_progress' && step.at) {
      return t('customer:details.timeline.planned', { time: format.dateTime(step.at) });
    }
    return step.at ? format.dateTime(step.at) : null;
  };

  return (
    <Card padding="lg" testID="request-timeline">
      <AppText variant="heading" accessibilityRole="header" style={styles.title}>
        {t('customer:details.timeline.title')}
      </AppText>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const next = steps[index + 1];
        const tone =
          step.state === 'cancelled'
            ? theme.colors.tones.danger
            : step.state === 'done'
              ? theme.colors.tones.success
              : step.state === 'current'
                ? theme.colors.tones.brand
                : null;
        const lineColor = next && next.state !== 'upcoming' ? theme.colors.tones.success.solid : theme.colors.border;
        const text = caption(step);
        const label = t(`customer:details.timeline.steps.${step.key}`);
        return (
          <View key={step.key} style={styles.step} accessible accessibilityLabel={[label, text].filter(Boolean).join(', ')}>
            <View style={styles.rail}>
              <View
                style={[
                  styles.dot,
                  tone
                    ? { backgroundColor: step.state === 'current' ? tone.bg : tone.solid, borderColor: tone.solid }
                    : { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderStrong },
                ]}
              >
                {step.state === 'done' ? (
                  <Icon name="check" size={14} color="onPrimary" />
                ) : step.state === 'cancelled' ? (
                  <Icon name="close" size={14} color="onPrimary" />
                ) : (
                  <Icon name={STEP_ICONS[step.key]} size={14} color={tone ? tone.fg : 'muted'} />
                )}
              </View>
              {!isLast ? <View style={[styles.line, { backgroundColor: lineColor }]} /> : null}
            </View>
            <View style={[styles.texts, !isLast ? styles.textsSpacing : null]}>
              <AppText
                variant={step.state === 'current' ? 'bodyStrong' : 'body'}
                color={step.state === 'upcoming' ? 'muted' : step.state === 'cancelled' ? 'danger' : step.state === 'current' ? 'primary' : 'default'}
              >
                {label}
              </AppText>
              {text ? (
                <AppText variant="caption" color={step.state === 'current' ? 'secondary' : 'muted'}>
                  {text}
                </AppText>
              ) : null}
            </View>
          </View>
        );
      })}
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  title: {
    marginBottom: t.spacing.md,
  },
  step: {
    flexDirection: 'row',
    gap: t.spacing.md,
  },
  rail: {
    alignItems: 'center',
    width: 26,
  },
  dot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: {
    width: 2,
    flex: 1,
    minHeight: 14,
    marginVertical: t.spacing.xxs,
    borderRadius: 1,
  },
  texts: {
    flex: 1,
    gap: t.spacing.xxs,
    paddingTop: t.spacing.xxs,
  },
  textsSpacing: {
    paddingBottom: t.spacing.lg,
  },
}));
