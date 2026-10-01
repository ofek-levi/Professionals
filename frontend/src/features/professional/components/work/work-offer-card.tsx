/** One of the professional's offers in the Work tab: category, one-line description, then price · time with the status pill at its end. */
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CategoryIcon } from '@/components/categories';
import { AppText, Card } from '@/components/ui';
import { ProfessionalOfferStatusBadge } from '@/features/offers/components/offer-status-display';
import { getProfessionalOfferOutcome } from '@/features/offers/offer-status-machine';
import { useCategoryName, useFormatters } from '@/i18n/hooks';
import { makeStyles } from '@/theme';
import type { OfferWithRequest } from '@/types/domain';

interface WorkOfferCardProps {
  offer: OfferWithRequest;
  /** Hide the status pill where the section title already says it ("Waiting for reply"). */
  showStatus?: boolean;
  onPress: () => void;
  testID?: string;
}

export function WorkOfferCard({ offer, showStatus = true, onPress, testID }: WorkOfferCardProps) {
  const styles = useStyles();
  const { t } = useTranslation(['offers', 'common']);
  const format = useFormatters();
  const category = useCategoryName(offer.request.categoryId) || t('common:category.unknown');
  const outcome = getProfessionalOfferOutcome(offer.status, offer.request.status, offer.statusReason);
  const terms = [format.currency(offer.price, offer.currency), format.dateTime(offer.proposedStartAt)].join(' · ');
  const statusLabel =
    outcome === 'job_cancelled'
      ? t('offers:jobCancelled.badge')
      : outcome === 'request_cancelled'
        ? t('offers:requestCancelled.badge')
        : t(`common:offerStatus.${outcome}`);

  return (
    <Card onPress={onPress} padding="none" accessibilityLabel={[category, statusLabel, terms].join(', ')} testID={testID}>
      <View style={styles.row}>
        <CategoryIcon categoryId={offer.request.categoryId} size="sm" />
        <View style={styles.texts}>
          <AppText variant="bodyStrong" numberOfLines={2}>
            {category}
          </AppText>
          <AppText variant="caption" color="secondary" numberOfLines={1} userContent>
            {offer.request.description}
          </AppText>
          <View style={styles.termsRow}>
            <AppText variant="captionStrong" numberOfLines={1} tabular style={styles.flex}>
              {terms}
            </AppText>
            {showStatus ? <ProfessionalOfferStatusBadge outcome={outcome} size="sm" /> : null}
          </View>
        </View>
      </View>
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.spacing.md,
    padding: t.spacing.lg,
  },
  texts: {
    flex: 1,
    gap: t.spacing.xxs,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    marginTop: t.spacing.xs,
  },
  flex: {
    flex: 1,
  },
}));
