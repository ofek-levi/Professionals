/** Compact list of the professional's pending offers with their expiry countdown. */
import { useRouter } from 'expo-router';
import { Fragment } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CategoryIcon } from '@/components/categories';
import { AppText, Card, Divider, Icon, PriceText, SectionHeader } from '@/components/ui';
import { ExpiryBadge } from '@/features/offers/components/expiry-badge';
import { useCategoryName, useFormatters } from '@/i18n/hooks';
import { routes } from '@/lib/routes';
import { makeStyles } from '@/theme';
import type { OfferWithRequest } from '@/types/domain';

export interface PendingOffersSectionProps {
  offers: OfferWithRequest[];
  totalCount: number;
}

export function PendingOffersSection({ offers, totalCount }: PendingOffersSectionProps) {
  const styles = useStyles();
  const router = useRouter();
  const { t } = useTranslation('professional');
  if (offers.length === 0) return null;
  return (
    <View testID="pro-home-pending-offers">
      <SectionHeader
        title={t('home.pendingOffers.title')}
        icon="timer-sand"
        subtitle={t('home.pendingOffers.subtitle', { count: totalCount })}
        actionLabel={t('home.seeAll')}
        onAction={() => router.push(routes.professional.offers)}
      />
      <Card padding="none" style={styles.card}>
        {offers.map((offer, index) => (
          <Fragment key={offer.id}>
            {index > 0 ? <Divider inset={68} /> : null}
            <PendingOfferRow offer={offer} />
          </Fragment>
        ))}
      </Card>
    </View>
  );
}

function PendingOfferRow({ offer }: { offer: OfferWithRequest }) {
  const styles = useStyles();
  const router = useRouter();
  const { t } = useTranslation(['professional', 'common']);
  const format = useFormatters();
  const category = useCategoryName(offer.request.categoryId) || t('common:category.unknown');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${category}, ${format.currency(offer.price, offer.currency)}, ${format.dateTime(offer.proposedStartAt)}`}
      onPress={() => router.push(routes.offer(offer.id))}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      <CategoryIcon categoryId={offer.request.categoryId} size="md" />
      <View style={styles.texts}>
        <View style={styles.titleRow}>
          <AppText variant="bodyStrong" numberOfLines={1} style={styles.shrink}>
            {category}
          </AppText>
          <PriceText amount={offer.price} currency={offer.currency} variant="bodyStrong" />
        </View>
        <AppText variant="caption" color="secondary" numberOfLines={1}>
          {format.dateTime(offer.proposedStartAt)}
        </AppText>
        <View style={styles.metaRow}>
          <ExpiryBadge expiresAt={offer.expiresAt} />
          <AppText variant="caption" color="muted" numberOfLines={1}>
            {t('common:counts.offers', { count: offer.request.pendingOfferCount })}
          </AppText>
        </View>
      </View>
      <Icon name="chevron-right" size={20} color="muted" flipInRTL />
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  card: {
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    padding: t.spacing.lg,
  },
  pressed: {
    backgroundColor: t.colors.surfacePressed,
  },
  texts: {
    flex: 1,
    gap: t.spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: t.spacing.sm,
  },
  shrink: {
    flexShrink: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    flexWrap: 'wrap',
  },
}));
