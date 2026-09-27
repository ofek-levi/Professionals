/**
 * The professional's own offer on a request: status, price, proposed time and the allowed actions
 * (edit / withdraw while pending, view offer, go to job once accepted).
 */
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { OfferStatusBadge } from '@/components/offers';
import { AppText, Button, Card, Divider, Icon, KeyValueRow, PriceText, Skeleton } from '@/components/ui';
import { OFFER_STATUS_META } from '@/constants/offer-statuses';
import { ExpiryBadge } from '@/features/offers/components/expiry-badge';
import { getProfessionalOfferActions } from '@/features/offers/offer-status-machine';
import { useOffer } from '@/hooks';
import { useFormatters } from '@/i18n/hooks';
import { makeStyles } from '@/theme';
import type { MyOfferSummary, RequestStatus } from '@/types/domain';

export interface MyOfferCardProps {
  myOffer: MyOfferSummary;
  requestStatus: RequestStatus;
  jobId: string | null;
  now: Date;
  withdrawing: boolean;
  onEdit: () => void;
  onWithdraw: () => void;
  onViewOffer: () => void;
  onOpenJob: (jobId: string) => void;
}

export function MyOfferCard({ myOffer, requestStatus, jobId, now, withdrawing, onEdit, onWithdraw, onViewOffer, onOpenJob }: MyOfferCardProps) {
  const styles = useStyles();
  const { t } = useTranslation(['professional', 'offers', 'common']);
  const format = useFormatters();
  const details = useOffer(myOffer.offerId).data;
  // Actions need the expiry, which only the full offer carries.
  const actions = details
    ? getProfessionalOfferActions(details, requestStatus, now)
    : { canEdit: false, canWithdraw: false };
  const status = details?.status ?? myOffer.status;
  const accepted = status === 'accepted';

  return (
    <Card variant="elevated" padding="none" highlighted style={styles.card} testID="pro-request-my-offer">
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <Icon name="tag-check-outline" size={20} color="primary" />
          <AppText variant="subheading">{t('professional:request.myOffer.title')}</AppText>
        </View>
        <OfferStatusBadge status={status} size="sm" />
      </View>
      <View style={styles.body}>
        <View style={styles.priceRow}>
          <PriceText amount={details?.price ?? myOffer.price} currency={details?.currency ?? myOffer.currency} variant="title" />
          {status === 'pending' && details ? <ExpiryBadge expiresAt={details.expiresAt} /> : null}
        </View>
        <KeyValueRow icon="calendar-clock" label={t('professional:request.myOffer.proposed')} value={format.dateTime(details?.proposedStartAt ?? myOffer.proposedStartAt)} />
        {details?.estimatedDurationMinutes ? (
          <KeyValueRow icon="timer-outline" label={t('professional:request.myOffer.duration')} value={format.duration(details.estimatedDurationMinutes)} />
        ) : null}
        {details === undefined ? <Skeleton width="70%" height={12} /> : null}
        {details?.message ? (
          <View style={styles.message}>
            <Icon name="format-quote-open" size={18} color="muted" />
            <AppText variant="caption" color="secondary" numberOfLines={3} style={styles.flex}>
              {details.message}
            </AppText>
          </View>
        ) : null}
        {details && status !== 'pending' && details.statusReason ? (
          <View style={styles.reason}>
            <Icon name={OFFER_STATUS_META[status].icon} size={16} color={OFFER_STATUS_META[status].tone} />
            <AppText variant="caption" color="secondary" style={styles.flex}>
              {t(`common:offerStatusReason.${details.statusReason}`)}
            </AppText>
          </View>
        ) : null}
      </View>
      <Divider />
      <View style={styles.actions}>
        {accepted && jobId ? (
          <Button label={t('offers:actions.goToJob')} size="sm" variant="success" leftIcon="briefcase-check-outline" onPress={() => onOpenJob(jobId)} style={styles.flex} />
        ) : null}
        {actions.canEdit ? (
          <Button label={t('offers:actions.edit')} size="sm" variant="secondary" leftIcon="pencil-outline" onPress={onEdit} style={styles.flex} testID="pro-request-edit-offer" />
        ) : null}
        {actions.canWithdraw ? (
          <Button
            label={t('offers:actions.withdraw')}
            size="sm"
            variant="outline"
            leftIcon="undo-variant"
            onPress={onWithdraw}
            loading={withdrawing}
            style={styles.flex}
            testID="pro-request-withdraw-offer"
          />
        ) : null}
        <Button label={t('offers:actions.viewOffer')} size="sm" variant="ghost" onPress={onViewOffer} style={styles.flex} />
      </View>
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  card: {
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: t.spacing.md,
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.md,
    backgroundColor: t.colors.primarySoft,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  body: {
    padding: t.spacing.lg,
    gap: t.spacing.xs,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: t.spacing.md,
    marginBottom: t.spacing.xs,
  },
  message: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.spacing.sm,
    padding: t.spacing.md,
    borderRadius: t.radii.md,
    backgroundColor: t.colors.surfaceMuted,
    marginTop: t.spacing.xs,
  },
  reason: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    marginTop: t.spacing.xs,
  },
  flex: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.md,
  },
}));
