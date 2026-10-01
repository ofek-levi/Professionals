import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Avatar, Button, Card, PriceText, RatingStars } from '@/components/ui';
import { useFormatters, usePersonName } from '@/i18n/hooks';
import { makeStyles } from '@/theme';
import type { OfferWithProfessional } from '@/types/domain';

interface OfferCardProps {
  offer: OfferWithProfessional;
  now: Date;
  /** The customer may accept it (pending, not expired, nothing accepted yet). */
  canAccept: boolean;
  accepting: boolean;
  /** Another offer is being accepted right now. */
  disabled: boolean;
  onAccept: () => void;
  onOpenProfessional: () => void;
}

/**
 * One offer: who (avatar, name, ★ rating), the proposed time with the price, a short message and
 * the decision. A professional who deleted their account has no profile to open.
 */
export function OfferCard({ offer, now, canAccept, accepting, disabled, onAccept, onOpenProfessional }: OfferCardProps) {
  const styles = useStyles();
  const { t } = useTranslation(['customer', 'common']);
  const format = useFormatters();
  const personName = usePersonName();
  const pro = offer.professional;
  const name = personName(pro);
  const message = offer.message?.trim();
  const hasProfile = !pro.accountDeleted;

  return (
    <Card padding="lg" style={styles.card} testID={`offer-card-${offer.id}`}>
      <View style={styles.top}>
        <Avatar name={name} uri={pro.avatarUrl} size="md" decorative />
        <View style={styles.who}>
          <AppText variant="bodyStrong" numberOfLines={2}>
            {name}
          </AppText>
          <RatingStars value={pro.averageRating} count={pro.reviewCount} variant="compact" size={13} textVariant="caption" />
        </View>
      </View>

      {/* When and how much on one line: the name keeps the full width above. */}
      <View style={styles.terms}>
        <AppText variant="bodyStrong" style={styles.shrink} testID={`offer-time-${offer.id}`}>
          {format.dateTime(offer.proposedStartAt, { now })}
        </AppText>
        <PriceText amount={offer.price} currency={offer.currency} variant="title" />
      </View>

      {message ? (
        <AppText variant="body" color="secondary" numberOfLines={2} userContent>
          {message}
        </AppText>
      ) : null}

      {hasProfile || canAccept ? (
        <View style={styles.actions}>
          {hasProfile ? (
            <Button
              label={t('customer:offers.viewProfile')}
              variant="ghost"
              size="sm"
              onPress={onOpenProfessional}
              testID={`offer-pro-${offer.id}`}
            />
          ) : null}
          {canAccept ? (
            <Button
              label={t('customer:offers.accept')}
              size="sm"
              loading={accepting}
              disabled={disabled}
              onPress={onAccept}
              style={styles.accept}
              testID={`offer-accept-${offer.id}`}
            />
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  card: {
    gap: t.spacing.md,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
  },
  who: {
    flex: 1,
    gap: t.spacing.xxs,
  },
  shrink: {
    flexShrink: 1,
  },
  terms: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: t.spacing.md,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: t.spacing.sm,
  },
  accept: {
    minWidth: 96,
  },
}));
