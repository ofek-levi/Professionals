/** Presentational blocks of the job tracking screen. */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Avatar, Card, Icon, PriceText, RatingStars, Skeleton } from '@/components/ui';
import { useCategoryName, useFormatters } from '@/i18n/hooks';
import { makeStyles, useTheme } from '@/theme';
import type { JobDetails, UserRole } from '@/types/domain';
import { isolateText } from '@/utils/bidi';
import { addMinutes } from '@/utils/dates';

import { getJobTimeline, type JobTimelineStep } from './job-view-model';

/** Name of the other party of the job, from the viewer's perspective. */
export function getCounterpartName(job: Pick<JobDetails, 'professional' | 'customer'>, role: UserRole): string {
  return role === 'customer' ? job.professional.displayName : job.customer.displayName;
}

// ─────────────────────────────── Status ───────────────────────────────

/** Category, one status sentence and a slim progress indicator. */
export function JobStatusHeader({ job, role }: { job: JobDetails; role: UserRole }) {
  const styles = useStyles();
  const { t } = useTranslation(['jobs', 'common']);
  const format = useFormatters();
  const categoryName = useCategoryName(job.categoryId) || t('common:category.unknown');
  const name = isolateText(getCounterpartName(job, role));
  const headlineDate =
    job.status === 'completed'
      ? format.date(job.completedAt ?? job.updatedAt, 'dayMonth')
      : format.dateTime(job.scheduledStartAt, { casing: 'inline' });

  return (
    <View style={styles.header} testID="job-status">
      <View style={styles.headerTexts}>
        <AppText variant="title" accessibilityRole="header" numberOfLines={2}>
          {categoryName}
        </AppText>
        <AppText variant="body" color={job.status === 'cancelled' ? 'danger' : 'secondary'}>
          {t(`jobs:details.headline.${job.status}.${role}`, { name, date: headlineDate })}
        </AppText>
      </View>
      {job.status === 'cancelled' ? null : <JobProgress steps={getJobTimeline(job)} />}
    </View>
  );
}

const REACHED: ReadonlySet<JobTimelineStep['state']> = new Set(['done', 'active', 'skipped']);

/** Four thin segments (booked → confirmed → started → done) with short labels. */
function JobProgress({ steps }: { steps: JobTimelineStep[] }) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation('jobs');
  const current = steps.filter((step) => REACHED.has(step.state)).pop();
  return (
    <View
      style={styles.progress}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={current ? t(`details.progress.${current.key}`) : undefined}
      testID="job-progress"
    >
      {steps.map((step) => {
        const reached = REACHED.has(step.state);
        return (
          <View key={step.key} style={styles.progressStep}>
            <View style={[styles.progressBar, { backgroundColor: reached ? theme.colors.primary : theme.colors.border }]} />
            <AppText variant="tiny" color={reached ? 'default' : 'muted'} numberOfLines={1}>
              {t(`details.progress.${step.key}`)}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

// ─────────────────────────────── Details ───────────────────────────────

function InfoRow({ label, children, first = false }: { label: string; children: ReactNode; first?: boolean }) {
  const styles = useStyles();
  return (
    <View style={[styles.infoRow, first ? null : styles.divider]}>
      <AppText variant="caption" color="muted">
        {label}
      </AppText>
      {children}
    </View>
  );
}

/** Appointment, agreed price and the full address (with access notes) in one group. */
export function JobInfoCard({ job }: { job: JobDetails }) {
  const styles = useStyles();
  const { t } = useTranslation('jobs');
  const format = useFormatters();
  const start = new Date(job.scheduledStartAt);
  const end = job.estimatedDurationMinutes ? addMinutes(start, job.estimatedDurationMinutes) : null;
  const time = end ? t('details.appointment.timeRange', { start: format.time(start), end: format.time(end) }) : format.time(start);
  const { location } = job;
  const address = [location.addressLine, location.neighborhood, location.city].filter(Boolean).join(', ');
  const extra = [location.details, job.request.notes?.trim()].filter(Boolean).join(' · ');

  return (
    <Card padding="none" style={styles.card} testID="job-info">
      <InfoRow label={t('details.appointment.title')} first>
        <AppText variant="bodyStrong" tabular>
          {`${format.date(start, 'short')} · ${time}`}
        </AppText>
      </InfoRow>
      <InfoRow label={t('details.price.title')}>
        <PriceText amount={job.agreedPrice} currency={job.currency} variant="bodyStrong" />
      </InfoRow>
      <InfoRow label={t('details.location.title')}>
        <AppText variant="bodyStrong">{address}</AppText>
        {extra ? (
          <AppText variant="caption" color="secondary" userContent>
            {extra}
          </AppText>
        ) : null}
      </InfoRow>
    </Card>
  );
}

/** The other party: avatar and name (+ the rating of a professional; the address is in the card below). */
export function CounterpartRow({ job, role, onPress }: { job: JobDetails; role: UserRole; onPress?: () => void }) {
  const styles = useStyles();
  const { t } = useTranslation(['jobs', 'common']);
  const person = role === 'customer' ? job.professional : job.customer;
  const label = role === 'customer' ? t('jobs:details.counterpart.professional') : t('jobs:details.counterpart.customer');

  const content = (
    <>
      <Avatar name={person.displayName} uri={person.avatarUrl} size="md" decorative />
      <View style={styles.flex}>
        <AppText variant="caption" color="muted">
          {label}
        </AppText>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {person.displayName}
        </AppText>
      </View>
      {role === 'customer' ? (
        <RatingStars value={job.professional.averageRating} count={job.professional.reviewCount} variant="compact" />
      ) : null}
      {onPress ? <Icon name="chevron-right" size={20} color="muted" flipInRTL /> : null}
    </>
  );

  if (!onPress) {
    return (
      <Card padding="none" style={[styles.card, styles.counterpart]} testID="job-counterpart">
        {content}
      </Card>
    );
  }
  return (
    <Card
      padding="none"
      onPress={onPress}
      accessibilityLabel={`${label}, ${person.displayName}`}
      style={[styles.card, styles.counterpart]}
      testID="job-counterpart"
    >
      {content}
    </Card>
  );
}

/** Quiet text action (secondary job actions, "View request"). */
export function TextAction({
  label,
  onPress,
  disabled = false,
  chevron = false,
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  chevron?: boolean;
  testID?: string;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.textAction, pressed || disabled ? styles.pressed : null]}
      testID={testID}
    >
      <AppText variant="bodyStrong" color="primary">
        {label}
      </AppText>
      {chevron ? <Icon name="chevron-right" size={18} color="primary" flipInRTL /> : null}
    </Pressable>
  );
}

// ─────────────────────────────── Loading ───────────────────────────────

export function JobDetailsSkeleton() {
  const styles = useStyles();
  return (
    <View style={styles.skeleton}>
      <View style={styles.headerTexts}>
        <Skeleton width="50%" height={24} />
        <Skeleton width="85%" height={14} />
      </View>
      <Skeleton height={4} radius={2} />
      <Card padding="none" style={styles.card}>
        {[0, 1, 2].map((index) => (
          <View key={index} style={[styles.infoRow, index === 0 ? null : styles.divider]}>
            <Skeleton width="25%" height={11} />
            <Skeleton width="60%" height={15} />
          </View>
        ))}
      </Card>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  flex: {
    flex: 1,
    gap: t.spacing.xxs,
  },
  header: {
    gap: t.spacing.xl,
  },
  headerTexts: {
    gap: t.spacing.xs,
  },
  progress: {
    flexDirection: 'row',
    gap: t.spacing.xs,
  },
  progressStep: {
    flex: 1,
    gap: t.spacing.xs + 2,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
  },
  card: {
    paddingHorizontal: t.spacing.lg,
  },
  infoRow: {
    gap: t.spacing.xxs,
    paddingVertical: t.spacing.md + 2,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.border,
  },
  counterpart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    paddingVertical: t.spacing.md,
  },
  textAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xxs,
    minHeight: 44,
  },
  pressed: {
    opacity: 0.5,
  },
  skeleton: {
    gap: t.spacing.xl,
  },
}));
