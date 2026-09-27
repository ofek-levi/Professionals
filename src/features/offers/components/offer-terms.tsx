/**
 * The terms of an offer: price, appointment date and time, estimated duration and message.
 * Used by the offer details and the live preview of the offer form.
 */
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Icon, PriceText, type IconSource } from '@/components/ui';
import { useFormatters } from '@/i18n/hooks';
import { makeStyles } from '@/theme';
import type { CurrencyCode } from '@/types/domain';

export interface OfferTermsProps {
  price: number | null;
  currency: CurrencyCode;
  /** ISO start, or `null` while not chosen yet (preview). */
  proposedStartAt: string | null;
  estimatedDurationMinutes: number | null;
  message: string | null;
  /** Emphasize the price (details) or keep it compact (preview). */
  size?: 'lg' | 'md';
}

export function OfferTerms({ price, currency, proposedStartAt, estimatedDurationMinutes, message, size = 'lg' }: OfferTermsProps) {
  const styles = useStyles();
  const { t } = useTranslation('offers');
  const format = useFormatters();
  const facts: { key: string; icon: IconSource; label: string; value: string }[] = [
    {
      key: 'date',
      icon: 'calendar-month-outline',
      label: t('terms.date'),
      value: proposedStartAt ? format.dateLabel(proposedStartAt, { preset: 'short' }) : t('terms.notSet'),
    },
    { key: 'time', icon: 'clock-outline', label: t('terms.time'), value: proposedStartAt ? format.time(proposedStartAt) : t('terms.notSet') },
    {
      key: 'duration',
      icon: 'timer-outline',
      label: t('terms.duration'),
      value: estimatedDurationMinutes ? format.duration(estimatedDurationMinutes) : t('terms.durationUnknown'),
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.priceRow}>
        <AppText variant="captionStrong" color="muted">
          {t('terms.price')}
        </AppText>
        {price !== null ? (
          <PriceText amount={price} currency={currency} variant={size === 'lg' ? 'display' : 'title'} color="primary" />
        ) : (
          <AppText variant={size === 'lg' ? 'display' : 'title'} color="muted">
            {t('terms.priceEmpty')}
          </AppText>
        )}
      </View>
      <View style={styles.facts}>
        {facts.map((fact) => (
          <View key={fact.key} style={styles.fact} accessible accessibilityLabel={`${fact.label}: ${fact.value}`}>
            <Icon name={fact.icon} size={18} color="primary" />
            <AppText variant="tiny" color="muted" numberOfLines={1}>
              {fact.label}
            </AppText>
            <AppText variant="captionStrong" numberOfLines={2}>
              {fact.value}
            </AppText>
          </View>
        ))}
      </View>
      {message ? (
        <View style={styles.message}>
          <Icon name="message-text-outline" size={18} color="muted" />
          <AppText variant="body" color="secondary" style={styles.flex} userContent>
            {message}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  container: {
    gap: t.spacing.md,
  },
  priceRow: {
    gap: t.spacing.xxs,
  },
  facts: {
    flexDirection: 'row',
    gap: t.spacing.sm,
  },
  fact: {
    flex: 1,
    gap: t.spacing.xxs,
    padding: t.spacing.md,
    borderRadius: t.radii.md,
    backgroundColor: t.colors.surfaceMuted,
  },
  message: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.spacing.sm,
    padding: t.spacing.md,
    borderRadius: t.radii.md,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  flex: {
    flex: 1,
  },
}));
