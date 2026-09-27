/** Small presentational cards of the professional request details. */
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CategoryIcon } from '@/components/categories';
import { PhotoStrip, PreferredScheduleText, RequestStatusBadge, UrgencyBadge } from '@/components/requests';
import { AppText, Avatar, Card, Icon, Skeleton, TimeAgo } from '@/components/ui';
import { useCategoryName, useFormatters } from '@/i18n/hooks';
import { makeStyles, useTheme } from '@/theme';
import type { CustomerSummary, ProfessionalRequestView } from '@/types/domain';

export function RequestHeaderCard({ request }: { request: ProfessionalRequestView }) {
  const styles = useStyles();
  const { t } = useTranslation(['professional', 'common']);
  const categoryName = useCategoryName(request.categoryId) || t('common:category.unknown');
  return (
    <Card variant="elevated" padding="lg" style={styles.gap} testID="pro-request-header">
      <View style={styles.headerRow}>
        <CategoryIcon categoryId={request.categoryId} size="lg" />
        <View style={styles.flex}>
          <AppText variant="title" accessibilityRole="header" numberOfLines={2}>
            {categoryName}
          </AppText>
          <View style={styles.inline}>
            <Icon name="clock-outline" size={14} color="muted" />
            <AppText variant="caption" color="muted">
              {t('professional:request.posted')}
            </AppText>
            <TimeAgo date={request.publishedAt ?? request.createdAt} />
          </View>
        </View>
      </View>
      <View style={styles.badges}>
        <UrgencyBadge level={request.urgency} />
        <RequestStatusBadge status={request.status} />
      </View>
      <View style={styles.scheduleBox}>
        <View style={styles.scheduleIcon}>
          <Icon name="calendar-heart" size={20} color="primary" />
        </View>
        <View style={styles.flex}>
          <AppText variant="tiny" color="muted">
            {t('professional:request.preferredTime')}
          </AppText>
          <PreferredScheduleText schedule={request.preferredSchedule} format="full" withIcon={false} variant="bodyStrong" color="default" numberOfLines={2} />
        </View>
      </View>
      <AppText variant="caption" color="secondary">
        {t(`common:urgency.${request.urgency}.description`)}
      </AppText>
    </Card>
  );
}

export function RequestDescriptionCard({ request }: { request: ProfessionalRequestView }) {
  const styles = useStyles();
  const { t } = useTranslation('professional');
  return (
    <Card padding="lg" style={styles.gap} testID="pro-request-description">
      <AppText variant="subheading">{t('request.aboutJob')}</AppText>
      <AppText variant="body" color="secondary" selectable>
        {request.description}
      </AppText>
      {request.notes ? (
        <View style={styles.notes}>
          <Icon name="note-text-outline" size={16} color="secondary" />
          <AppText variant="caption" color="secondary" style={styles.flex}>
            {request.notes}
          </AppText>
        </View>
      ) : null}
      {request.photos.length > 0 ? (
        <View style={styles.gapSm}>
          <AppText variant="captionStrong" color="muted">
            {t('request.photos', { count: request.photos.length })}
          </AppText>
          <PhotoStrip photos={request.photos} size={88} />
        </View>
      ) : null}
    </Card>
  );
}

export function CustomerCard({ customer }: { customer: CustomerSummary }) {
  const styles = useStyles();
  const { t } = useTranslation('professional');
  const format = useFormatters();
  return (
    <Card padding="lg" testID="pro-request-customer">
      <View style={styles.headerRow}>
        <Avatar name={customer.displayName} uri={customer.avatarUrl} size="md" />
        <View style={styles.flex}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {customer.displayName}
          </AppText>
          {customer.city ? (
            <AppText variant="caption" color="secondary" numberOfLines={1}>
              {customer.city}
            </AppText>
          ) : null}
          <AppText variant="caption" color="muted" numberOfLines={1}>
            {t('request.customer.memberSince', { date: format.date(customer.memberSince, 'monthYear') })}
          </AppText>
        </View>
        <View style={styles.customerStat}>
          <AppText variant="heading" tabular>
            {format.number(customer.completedJobsCount)}
          </AppText>
          <AppText variant="tiny" color="muted" align="center">
            {t('request.customer.jobs', { count: customer.completedJobsCount })}
          </AppText>
        </View>
      </View>
    </Card>
  );
}

export function CompetitionCard({ request }: { request: ProfessionalRequestView }) {
  const styles = useStyles();
  const theme = useTheme();
  const { t } = useTranslation('professional');
  const count = request.offerCount;
  const tone = count === 0 ? 'accent' : count >= 4 ? 'warning' : 'info';
  const colors = theme.colors.tones[tone];
  return (
    <View style={[styles.competition, { backgroundColor: colors.bg }]} testID="pro-request-competition">
      <Icon name={count === 0 ? 'rocket-launch-outline' : 'account-group-outline'} size={22} color={colors.fg} />
      <View style={styles.flex}>
        <AppText variant="bodyStrong" color={colors.fg}>
          {count === 0 ? t('request.competition.none') : t('request.competition.some', { count })}
        </AppText>
        <AppText variant="caption" color="secondary">
          {count === 0 ? t('request.competition.noneHint') : t('request.competition.someHint')}
        </AppText>
      </View>
    </View>
  );
}

export function RequestDetailsSkeleton() {
  const styles = useStyles();
  return (
    <View style={styles.skeleton}>
      <Card padding="lg" style={styles.gap}>
        <View style={styles.headerRow}>
          <Skeleton width={56} height={56} radius={16} />
          <View style={[styles.flex, styles.gapSm]}>
            <Skeleton width="60%" height={20} />
            <Skeleton width="35%" height={12} />
          </View>
        </View>
        <Skeleton width="50%" height={24} radius={999} />
        <Skeleton height={56} radius={12} />
      </Card>
      <Card padding="lg" style={styles.gap}>
        <Skeleton width="40%" height={16} />
        <Skeleton height={12} />
        <Skeleton width="80%" height={12} />
      </Card>
      <Skeleton height={220} radius={16} />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  gap: {
    gap: t.spacing.md,
  },
  gapSm: {
    gap: t.spacing.sm,
  },
  flex: {
    flex: 1,
    gap: t.spacing.xxs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.spacing.sm,
  },
  scheduleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    padding: t.spacing.md,
    borderRadius: t.radii.md,
    backgroundColor: t.colors.primarySoft,
  },
  scheduleIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: t.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notes: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.spacing.sm,
    padding: t.spacing.md,
    borderRadius: t.radii.md,
    backgroundColor: t.colors.surfaceMuted,
  },
  customerStat: {
    alignItems: 'center',
    minWidth: 64,
  },
  competition: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    padding: t.spacing.lg,
    borderRadius: t.radii.lg,
  },
  skeleton: {
    gap: t.spacing.lg,
  },
}));
