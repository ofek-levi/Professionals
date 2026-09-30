/** Presentational blocks of the professional's request details. */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { PhotoStrip, PreferredScheduleText, UrgencyBadge } from '@/components/requests';
import { AppText, Card, Skeleton, useNow } from '@/components/ui';
import { useCategoryName, useFormatters, usePersonName } from '@/i18n/hooks';
import { makeStyles } from '@/theme';
import type { ProfessionalRequestView } from '@/types/domain';

/**
 * Category title, urgency pill + "distance · posted" (+ "N offers so far" while the request takes
 * offers), the description and the photos.
 */
export function RequestSummary({ request, showOfferCount = false }: { request: ProfessionalRequestView; showOfferCount?: boolean }) {
  const styles = useStyles();
  const { t } = useTranslation(['common', 'professional']);
  const format = useFormatters();
  const now = useNow(60_000);
  const categoryName = useCategoryName(request.categoryId) || t('common:category.unknown');
  const offers = request.pendingOfferCount;
  const meta = [
    format.distance(request.distanceKm),
    format.relative(request.publishedAt ?? request.createdAt, now),
    showOfferCount ? (offers === 0 ? t('professional:request.info.noOffers') : t('professional:request.info.offersSoFar', { count: offers })) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.summary} testID="pro-request-header">
      <View style={styles.titleBlock}>
        <AppText variant="title" accessibilityRole="header" numberOfLines={2}>
          {categoryName}
        </AppText>
        <View style={styles.metaRow}>
          <UrgencyBadge level={request.urgency} size="sm" />
          <AppText variant="caption" color="muted" numberOfLines={2} style={styles.shrink} testID="pro-request-meta">
            {meta}
          </AppText>
        </View>
      </View>
      <AppText variant="body" selectable userContent testID="pro-request-description">
        {request.description}
      </AppText>
      {request.photos.length > 0 ? <PhotoStrip photos={request.photos} /> : null}
    </View>
  );
}

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

/**
 * Where (the approximate area until the professional is hired, then the exact address and access
 * notes), the customer's preferred time and the customer.
 */
export function RequestInfoCard({ request }: { request: ProfessionalRequestView }) {
  const styles = useStyles();
  const { t } = useTranslation('professional');
  const personName = usePersonName();
  const { location } = request;
  const area = [location.neighborhood, location.city].filter(Boolean).join(', ');
  const exact = !location.isApproximate;
  const extra = exact ? [location.details, request.notes?.trim()].filter(Boolean).join(' · ') : '';

  return (
    <Card padding="none" style={styles.card} testID="pro-request-info">
      <InfoRow label={exact ? t('request.info.address') : t('request.info.area')} first>
        <AppText variant="bodyStrong">{exact ? [location.addressLine, area].filter(Boolean).join(', ') : area}</AppText>
        {extra ? (
          <AppText variant="caption" color="secondary" userContent>
            {extra}
          </AppText>
        ) : null}
      </InfoRow>
      {request.preferredSchedule ? (
        <InfoRow label={t('request.info.preferredTime')}>
          <PreferredScheduleText schedule={request.preferredSchedule} variant="bodyStrong" color="default" />
        </InfoRow>
      ) : null}
      <InfoRow label={t('request.info.customer')}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {personName(request.customer)}
        </AppText>
      </InfoRow>
    </Card>
  );
}

export function RequestDetailsSkeleton() {
  const styles = useStyles();
  return (
    <View style={styles.skeleton}>
      <View style={styles.titleBlock}>
        <Skeleton width="50%" height={24} />
        <Skeleton width="60%" height={14} />
      </View>
      <View style={styles.titleBlock}>
        <Skeleton height={14} />
        <Skeleton width="80%" height={14} />
      </View>
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
  summary: {
    gap: t.spacing.lg,
  },
  titleBlock: {
    gap: t.spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  shrink: {
    flexShrink: 1,
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
  skeleton: {
    gap: t.spacing.xl,
  },
}));
