/**
 * The professional's own offer on a request: status, price and proposed time, with Edit / Withdraw
 * while it can still change.
 */
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Button, Card, PriceText } from '@/components/ui';
import { ProfessionalOfferStatusBadge } from '@/features/offers/components/offer-status-display';
import { getProfessionalOfferActions, getProfessionalOfferOutcome } from '@/features/offers/offer-status-machine';
import { useOffer } from '@/hooks';
import { useFormatters } from '@/i18n/hooks';
import { makeStyles } from '@/theme';
import type { MyOfferSummary, RequestStatus } from '@/types/domain';

interface MyOfferCardProps {
  myOffer: MyOfferSummary;
  requestStatus: RequestStatus;
  now: Date;
  withdrawing: boolean;
  onEdit: () => void;
  onWithdraw: () => void;
}

export function MyOfferCard({ myOffer, requestStatus, now, withdrawing, onEdit, onWithdraw }: MyOfferCardProps) {
  const styles = useStyles();
  const { t } = useTranslation(['professional', 'offers']);
  const format = useFormatters();
  const details = useOffer(myOffer.offerId).data;
  // Actions need the expiry, which only the full offer carries.
  const actions = details ? getProfessionalOfferActions(details, requestStatus, now) : { canEdit: false, canWithdraw: false };
  const outcome = getProfessionalOfferOutcome(details?.status ?? myOffer.status, requestStatus);

  return (
    <Card padding="lg" style={styles.card} testID="pro-request-my-offer">
      <View style={styles.row}>
        <AppText variant="captionStrong" color="secondary" style={styles.flex}>
          {t('professional:request.myOffer')}
        </AppText>
        <ProfessionalOfferStatusBadge outcome={outcome} size="sm" />
      </View>
      <View style={styles.terms}>
        <PriceText amount={details?.price ?? myOffer.price} currency={details?.currency ?? myOffer.currency} variant="title" />
        <AppText variant="body" color="secondary" tabular>
          {format.dateTime(details?.proposedStartAt ?? myOffer.proposedStartAt)}
        </AppText>
      </View>
      {actions.canEdit || actions.canWithdraw ? (
        <View style={styles.actions}>
          {actions.canEdit ? (
            <Button label={t('offers:actions.edit')} variant="ghost" size="sm" onPress={onEdit} style={styles.action} testID="pro-request-edit-offer" />
          ) : null}
          {actions.canWithdraw ? (
            <Button
              label={t('offers:actions.withdraw')}
              variant="dangerGhost"
              size="sm"
              onPress={onWithdraw}
              loading={withdrawing}
              style={styles.action}
              testID="pro-request-withdraw-offer"
            />
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  card: {
    gap: t.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  flex: {
    flex: 1,
  },
  terms: {
    gap: t.spacing.xxs,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.lg,
    marginTop: t.spacing.xs,
  },
  // Text buttons sit flush with the card's content edge.
  action: {
    paddingHorizontal: 0,
    minWidth: 0,
  },
}));
