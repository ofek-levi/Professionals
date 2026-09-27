import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CategoryIcon, CategoryName } from '@/components/categories';
import { LocationSummary } from '@/components/location';
import { AppMap } from '@/components/map';
import { PhotoStrip, PreferredScheduleText, RequestStatusBadge, UrgencyBadge } from '@/components/requests';
import { AppText, Card, Divider, Icon, Skeleton, SkeletonCard, TimeAgo, type IconSource } from '@/components/ui';
import { URGENCY_META } from '@/constants/urgency-levels';
import { makeStyles, useTheme } from '@/theme';
import type { CustomerRequestView } from '@/types/domain';
import { regionForRadius } from '@/utils/geo';

/** Zoom of the small location preview map (~ a few streets). */
const PREVIEW_RADIUS_KM = 0.6;

/** Category, status, urgency, age, description and photos. */
export function RequestOverviewCard({ request }: { request: CustomerRequestView }) {
  const styles = useStyles();
  const { t } = useTranslation('customer');
  const isDraft = request.status === 'draft';

  return (
    <Card padding="lg" testID="request-overview">
      <View style={styles.hero}>
        <CategoryIcon categoryId={request.categoryId} size="lg" />
        <View style={styles.heroTexts}>
          <CategoryName categoryId={request.categoryId} variant="title" numberOfLines={2} accessibilityRole="header" />
          <View style={styles.inline}>
            <Icon name={isDraft ? 'content-save-outline' : 'clock-outline'} size={14} color="muted" />
            <AppText variant="caption" color="muted">
              {isDraft ? t('details.savedAsDraft') : t('details.posted')}
            </AppText>
            <TimeAgo date={request.publishedAt ?? request.createdAt} />
          </View>
        </View>
      </View>
      <View style={styles.badges}>
        <RequestStatusBadge status={request.status} />
        <UrgencyBadge level={request.urgency} />
      </View>
      <Divider spacing="md" />
      <AppText variant="body" selectable>
        {request.description}
      </AppText>
      {request.photos.length > 0 ? (
        <View style={styles.photos}>
          <AppText variant="captionStrong" color="secondary">
            {t('details.photos', { count: request.photos.length })}
          </AppText>
          <PhotoStrip photos={request.photos} size={84} />
        </View>
      ) : null}
    </Card>
  );
}

function InfoRow({ icon, label, children }: { icon: IconSource; label: string; children: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Icon name={icon} size={18} color="primary" />
      </View>
      <View style={styles.infoTexts}>
        <AppText variant="label" color="muted">
          {label}
        </AppText>
        {children}
      </View>
    </View>
  );
}

/** Where and when: location with a map preview, preferred schedule, urgency and notes. */
export function RequestLogisticsCard({ request }: { request: CustomerRequestView }) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation(['customer', 'common']);
  const coordinates = request.location.coordinates;
  const urgencyTone = theme.colors.tones[URGENCY_META[request.urgency].tone];

  return (
    <Card padding="none" testID="request-logistics">
      <AppMap
        style={styles.map}
        interactive={false}
        initialRegion={regionForRadius(coordinates, PREVIEW_RADIUS_KM)}
        markers={[{ id: request.id, coordinate: coordinates, icon: 'home-map-marker', tone: 'brand' }]}
        accessibilityLabel={t('customer:details.mapA11y')}
      />
      <View style={styles.logistics}>
        <LocationSummary location={request.location} />
        <Divider />
        <InfoRow icon="calendar-blank-outline" label={t('customer:details.preferredTime')}>
          <PreferredScheduleText schedule={request.preferredSchedule} format="full" withIcon={false} variant="bodyStrong" color="default" numberOfLines={2} />
        </InfoRow>
        <InfoRow icon={URGENCY_META[request.urgency].icon} label={t('customer:details.urgency')}>
          <AppText variant="bodyStrong" color={urgencyTone.fg}>
            {t(`common:urgency.${request.urgency}.label`)}
          </AppText>
          <AppText variant="caption" color="secondary">
            {t(`common:urgency.${request.urgency}.description`)}
          </AppText>
        </InfoRow>
        {request.notes ? (
          <InfoRow icon="note-text-outline" label={t('customer:details.notes')}>
            <AppText variant="body" selectable>
              {request.notes}
            </AppText>
          </InfoRow>
        ) : null}
      </View>
    </Card>
  );
}

/** Placeholder for the whole request screen. */
export function RequestDetailsSkeleton() {
  const styles = useStyles();
  return (
    <View style={styles.skeleton}>
      <Card padding="lg">
        <View style={styles.hero}>
          <Skeleton width={56} height={56} radius={16} />
          <View style={[styles.heroTexts, styles.skeletonTexts]}>
            <Skeleton width="60%" height={20} />
            <Skeleton width="35%" height={12} />
          </View>
        </View>
        <View style={[styles.badges, styles.skeletonBadges]}>
          <Skeleton width={96} height={24} radius={999} />
          <Skeleton width={80} height={24} radius={999} />
        </View>
        <View style={styles.skeletonTexts}>
          <Skeleton width="100%" height={13} />
          <Skeleton width="90%" height={13} />
          <Skeleton width="70%" height={13} />
        </View>
      </Card>
      <SkeletonCard lines={3} />
      <SkeletonCard lines={3} />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
  },
  heroTexts: {
    flex: 1,
    gap: t.spacing.xxs,
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
    marginTop: t.spacing.md,
  },
  photos: {
    gap: t.spacing.sm,
    marginTop: t.spacing.lg,
  },
  map: {
    height: 150,
    borderTopStartRadius: t.radii.lg,
    borderTopEndRadius: t.radii.lg,
    overflow: 'hidden',
  },
  logistics: {
    padding: t.spacing.lg,
    gap: t.spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    gap: t.spacing.md,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: t.radii.sm + 2,
    backgroundColor: t.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTexts: {
    flex: 1,
    gap: t.spacing.xxs,
  },
  skeleton: {
    gap: t.spacing.lg,
  },
  skeletonTexts: {
    gap: t.spacing.sm,
  },
  skeletonBadges: {
    marginBottom: t.spacing.lg,
  },
}));
