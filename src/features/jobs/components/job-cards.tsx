/** Presentational cards of the job tracking screen. */
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CategoryIcon } from '@/components/categories';
import { JobStatusBadge } from '@/components/jobs';
import { LocationSummary } from '@/components/location';
import { AppMap } from '@/components/map';
import { PhotoStrip } from '@/components/requests';
import { AppText, Avatar, Badge, Card, Divider, Icon, PriceText, Skeleton, SkeletonCard, type IconSource } from '@/components/ui';
import type { StatusTone } from '@/constants/tones';
import { useCategoryName, useFormatters } from '@/i18n/hooks';
import { makeStyles, useTheme } from '@/theme';
import type { JobDetails, UserRole } from '@/types/domain';
import { isolateText } from '@/utils/bidi';
import { addMinutes } from '@/utils/dates';
import { regionForRadius } from '@/utils/geo';

import { JobTimeline } from './job-timeline';
import { getAppointmentCountdown } from './job-view-model';

/** Name of the other party of the job, from the viewer's perspective. */
export function getCounterpartName(job: Pick<JobDetails, 'professional' | 'customer'>, role: UserRole): string {
  return role === 'customer' ? job.professional.displayName : job.customer.displayName;
}

// ─────────────────────────────── Hero ───────────────────────────────

export function JobHeroCard({ job, role, now }: { job: JobDetails; role: UserRole; now: Date }) {
  const styles = useStyles();
  const { t } = useTranslation(['jobs', 'common']);
  const format = useFormatters();
  const categoryName = useCategoryName(job.categoryId) || t('common:category.unknown');
  const name = isolateText(getCounterpartName(job, role));
  const headlineDate =
    job.status === 'completed'
      ? format.date(job.completedAt ?? job.updatedAt, 'dayMonth')
      : format.dateTime(job.scheduledStartAt, { relativeDay: false });

  return (
    <Card padding="lg" style={styles.gapLg} testID="job-hero">
      <View style={styles.heroHeader}>
        <CategoryIcon categoryId={job.categoryId} size="lg" />
        <View style={styles.flex}>
          <AppText variant="title" accessibilityRole="header" numberOfLines={2}>
            {categoryName}
          </AppText>
          <JobStatusBadge status={job.status} />
        </View>
      </View>
      <AppText variant="body" color="secondary">
        {t(`jobs:details.headline.${job.status}.${role}`, { name, date: headlineDate })}
      </AppText>
      <Divider />
      <JobTimeline job={job} role={role} now={now} />
    </Card>
  );
}

// ─────────────────────────────── Appointment & price ───────────────────────────────

function IconBox({ icon, tone }: { icon: IconSource; tone: StatusTone }) {
  const theme = useTheme();
  const styles = useStyles();
  const colors = theme.colors.tones[tone];
  return (
    <View style={[styles.iconBox, { backgroundColor: colors.bg }]}>
      <Icon name={icon} size={22} color={colors.fg} />
    </View>
  );
}

export function AppointmentCard({ job, now }: { job: JobDetails; now: Date }) {
  const styles = useStyles();
  const { t } = useTranslation('jobs');
  const format = useFormatters();
  const start = new Date(job.scheduledStartAt);
  const end = job.estimatedDurationMinutes ? addMinutes(start, job.estimatedDurationMinutes) : null;
  const timeText = end ? t('details.appointment.timeRange', { start: format.time(start), end: format.time(end) }) : format.time(start);

  let badge: { label: string; tone: StatusTone; icon: IconSource } | null = null;
  if (job.status === 'awaiting_confirmation' || job.status === 'scheduled') {
    const countdown = getAppointmentCountdown(start, now);
    switch (countdown.kind) {
      case 'soon':
        badge = { label: t('details.appointment.startsIn', { relative: format.relative(start, now, { casing: 'inline' }) }), tone: 'warning', icon: 'timer-sand' };
        break;
      case 'tomorrow':
        badge = { label: t('details.appointment.startsTomorrow'), tone: 'brand', icon: 'timer-sand' };
        break;
      case 'days':
        badge = { label: t('details.appointment.startsInDays', { count: countdown.days }), tone: 'brand', icon: 'calendar-clock' };
        break;
      case 'overdue':
        badge = { label: t('details.appointment.startedAgo', { relative: format.relative(start, now, { casing: 'inline' }) }), tone: 'warning', icon: 'clock-alert-outline' };
        break;
    }
  } else if (job.status === 'completed' && job.completedAt) {
    badge = { label: t('details.appointment.completedAt', { date: format.dateTime(job.completedAt, { relativeDay: false }) }), tone: 'success', icon: 'check-all' };
  } else if (job.status === 'cancelled' && job.cancelledAt) {
    badge = { label: t('details.appointment.cancelledAt', { date: format.dateTime(job.cancelledAt, { relativeDay: false }) }), tone: 'danger', icon: 'cancel' };
  }

  return (
    <Card padding="lg" testID="job-appointment">
      <View style={styles.row}>
        <IconBox icon="calendar-clock" tone="brand" />
        <View style={styles.flex}>
          <AppText variant="captionStrong" color="muted">
            {t('details.appointment.title')}
          </AppText>
          <AppText variant="subheading">{format.date(start, 'long')}</AppText>
          <View style={styles.inline}>
            <Icon name="clock-outline" size={16} color="secondary" />
            <AppText variant="bodyStrong" tabular>
              {timeText}
            </AppText>
            {job.estimatedDurationMinutes ? (
              <AppText variant="caption" color="muted">
                {`· ${format.duration(job.estimatedDurationMinutes)}`}
              </AppText>
            ) : null}
          </View>
          {badge ? <Badge label={badge.label} tone={badge.tone} icon={badge.icon} style={styles.badge} /> : null}
        </View>
      </View>
    </Card>
  );
}

export function PriceCard({ job, onViewOffer }: { job: JobDetails; onViewOffer: () => void }) {
  const styles = useStyles();
  const { t } = useTranslation('jobs');
  return (
    <Card padding="lg" testID="job-price">
      <View style={styles.row}>
        <IconBox icon="cash-multiple" tone="success" />
        <View style={styles.flex}>
          <AppText variant="captionStrong" color="muted">
            {t('details.price.title')}
          </AppText>
          <PriceText amount={job.agreedPrice} currency={job.currency} variant="title" />
          <AppText variant="caption" color="muted">
            {t('details.price.hint')}
          </AppText>
        </View>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t('details.price.viewOffer')}
          onPress={onViewOffer}
          hitSlop={8}
          style={({ pressed }) => [styles.link, pressed ? styles.pressed : null]}
          testID="job-view-offer"
        >
          <AppText variant="captionStrong" color="primary">
            {t('details.price.viewOffer')}
          </AppText>
          <Icon name="chevron-right" size={16} color="primary" flipInRTL />
        </Pressable>
      </View>
    </Card>
  );
}

// ─────────────────────────────── Location ───────────────────────────────

export function LocationCard({ job }: { job: JobDetails }) {
  const styles = useStyles();
  const { t } = useTranslation('jobs');
  const { coordinates } = job.location;
  return (
    <Card padding="none" style={styles.clip} testID="job-location">
      <AppMap
        style={styles.map}
        initialRegion={regionForRadius(coordinates, 0.6)}
        markers={[{ id: job.id, coordinate: coordinates, tone: 'brand', icon: 'home-map-marker' }]}
        interactive={false}
        accessibilityLabel={t('details.location.mapLabel')}
      />
      <View style={styles.locationBody}>
        <LocationSummary location={job.location} showDetails />
      </View>
    </Card>
  );
}

// ─────────────────────────────── Counterpart (customer, for professionals) ───────────────────────────────

export function CustomerCard({ job }: { job: JobDetails }) {
  const styles = useStyles();
  const { t } = useTranslation('jobs');
  const format = useFormatters();
  const { customer } = job;
  return (
    <Card padding="lg" testID="job-customer">
      <View style={styles.row}>
        <Avatar name={customer.displayName} uri={customer.avatarUrl} size="lg" decorative />
        <View style={styles.flex}>
          <AppText variant="subheading" numberOfLines={1}>
            {customer.displayName}
          </AppText>
          {customer.city ? (
            <View style={styles.inline}>
              <Icon name="map-marker-outline" size={15} color="muted" />
              <AppText variant="caption" color="secondary">
                {customer.city}
              </AppText>
            </View>
          ) : null}
          <View style={styles.inlineWrap}>
            <View style={styles.inline}>
              <Icon name="account-clock-outline" size={15} color="muted" />
              <AppText variant="caption" color="secondary">
                {t('details.counterpart.memberSince', { date: format.date(customer.memberSince, 'monthYear') })}
              </AppText>
            </View>
            <View style={styles.inline}>
              <Icon name="check-decagram-outline" size={15} color="muted" />
              <AppText variant="caption" color="secondary">
                {t('details.counterpart.jobsCompleted', { count: customer.completedJobsCount })}
              </AppText>
            </View>
          </View>
        </View>
      </View>
    </Card>
  );
}

// ─────────────────────────────── Request ───────────────────────────────

export function RequestSummaryCard({ job, onViewRequest }: { job: JobDetails; onViewRequest: () => void }) {
  const styles = useStyles();
  const { t } = useTranslation('jobs');
  const notes = job.request.notes?.trim();
  return (
    <Card padding="none" testID="job-request">
      <View style={styles.requestBody}>
        <AppText variant="body" userContent>
          {job.description}
        </AppText>
        {job.request.photos.length > 0 ? <PhotoStrip photos={job.request.photos} maxVisible={4} /> : null}
        {notes ? (
          <View style={styles.notes}>
            <Icon name="note-text-outline" size={18} color="muted" />
            <View style={styles.flex}>
              <AppText variant="captionStrong" color="muted">
                {t('details.request.notes')}
              </AppText>
              <AppText variant="caption" color="secondary" userContent>
                {notes}
              </AppText>
            </View>
          </View>
        ) : null}
      </View>
      <Divider />
      <Pressable
        accessibilityRole="link"
        onPress={onViewRequest}
        style={({ pressed }) => [styles.footerLink, pressed ? styles.pressedBackground : null]}
        testID="job-view-request"
      >
        <Icon name="clipboard-text-outline" size={20} color="primary" />
        <AppText variant="bodyStrong" color="primary" style={styles.flex}>
          {t('details.request.viewRequest')}
        </AppText>
        <Icon name="chevron-right" size={20} color="primary" flipInRTL />
      </Pressable>
    </Card>
  );
}

// ─────────────────────────────── Loading ───────────────────────────────

export function JobDetailsSkeleton() {
  const styles = useStyles();
  return (
    <View style={styles.skeleton}>
      <Card padding="lg" style={styles.gapLg}>
        <View style={styles.heroHeader}>
          <Skeleton width={56} height={56} radius={16} />
          <View style={[styles.flex, styles.gapSm]}>
            <Skeleton width="60%" height={20} />
            <Skeleton width={120} height={22} radius={999} />
          </View>
        </View>
        <Skeleton width="90%" height={14} />
        {[0, 1, 2, 3].map((index) => (
          <View key={index} style={styles.row}>
            <Skeleton circle height={24} />
            <Skeleton width="45%" height={13} />
          </View>
        ))}
      </Card>
      <SkeletonCard lines={1} />
      <SkeletonCard lines={1} withAvatar={false} />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  flex: {
    flex: 1,
    gap: t.spacing.xxs,
  },
  gapLg: {
    gap: t.spacing.lg,
  },
  gapSm: {
    gap: t.spacing.sm,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.spacing.md,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
  },
  inlineWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: t.spacing.md,
    rowGap: t.spacing.xxs,
  },
  badge: {
    marginTop: t.spacing.sm,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: t.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xxs,
    minHeight: 44,
    alignSelf: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  pressedBackground: {
    backgroundColor: t.colors.surfacePressed,
  },
  clip: {
    overflow: 'hidden',
  },
  map: {
    height: 150,
  },
  locationBody: {
    padding: t.spacing.lg,
  },
  requestBody: {
    padding: t.spacing.lg,
    gap: t.spacing.md,
  },
  notes: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.spacing.sm,
    padding: t.spacing.md,
    borderRadius: t.radii.md,
    backgroundColor: t.colors.surfaceMuted,
  },
  footerLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    paddingHorizontal: t.spacing.lg,
    minHeight: 52,
  },
  skeleton: {
    gap: t.spacing.lg,
  },
}));
