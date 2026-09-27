import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { OfferStatusBadge } from '@/components/offers';
import { AppText, Avatar, Badge, Button, Card, Divider, Icon, PriceText, RatingStars, type IconName } from '@/components/ui';
import type { StatusTone } from '@/constants/tones';
import { canCustomerAcceptOffer, isOfferExpired } from '@/features/offers/offer-status-machine';
import { useFormatters } from '@/i18n/hooks';
import { makeStyles, useTheme } from '@/theme';
import type { OfferWithProfessional, ServiceRequest } from '@/types/domain';

/** Remaining validity below which the expiry is shown as a warning. */
const EXPIRY_WARNING_MS = 3 * 60 * 60 * 1000;

export type OfferHighlightKey = 'lowestPrice' | 'earliest' | 'topRated';

const HIGHLIGHT_META: Record<OfferHighlightKey, { icon: IconName; tone: StatusTone }> = {
  lowestPrice: { icon: 'cash', tone: 'success' },
  earliest: { icon: 'clock-fast', tone: 'info' },
  topRated: { icon: 'star', tone: 'warning' },
};

export interface OfferCardProps {
  offer: OfferWithProfessional;
  highlights: readonly OfferHighlightKey[];
  now: Date;
  /** The request the offer belongs to (Accept follows the shared accept rule). */
  request: Pick<ServiceRequest, 'status' | 'acceptedOfferId'>;
  accepting: boolean;
  /** Another offer is being accepted right now. */
  disabled: boolean;
  onAccept: () => void;
  onOpenProfessional: () => void;
}

/** One offer: price, proposed appointment, the professional's credentials and the decision. */
export function OfferCard({ offer, highlights, now, request, accepting, disabled, onAccept, onOpenProfessional }: OfferCardProps) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation(['customer', 'common']);
  const format = useFormatters();
  const pro = offer.professional;
  const isPending = offer.status === 'pending';
  const isAccepted = offer.status === 'accepted';
  const expired = isOfferExpired(offer, now);
  const canAccept = canCustomerAcceptOffer(offer, request, now);
  const expiresSoon = isPending && Date.parse(offer.expiresAt) - now.getTime() < EXPIRY_WARNING_MS;
  const muted = !isPending && !isAccepted;
  const message = offer.message?.trim();

  return (
    <Card
      padding="none"
      highlighted={isAccepted}
      style={[isAccepted ? { borderColor: theme.colors.success } : null, muted ? styles.muted : null]}
      testID={`offer-card-${offer.id}`}
    >
      {isAccepted ? (
        <View style={[styles.acceptedBanner, { backgroundColor: theme.colors.tones.success.bg }]}>
          <Icon name="check-circle" size={16} color="success" />
          <AppText variant="captionStrong" color="success">
            {t('customer:offers.yourChoice')}
          </AppText>
        </View>
      ) : null}

      <View style={styles.body}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('customer:offers.viewProfileA11y', { name: pro.displayName })}
          onPress={onOpenProfessional}
          style={({ pressed }) => [styles.proRow, pressed ? styles.pressed : null]}
          testID={`offer-pro-${offer.id}`}
        >
          <Avatar name={pro.displayName} uri={pro.avatarUrl} size="md" verified={pro.isVerified} decorative />
          <View style={styles.proTexts}>
            <View style={styles.nameRow}>
              <AppText variant="bodyStrong" numberOfLines={1} style={styles.shrink}>
                {pro.displayName}
              </AppText>
              {pro.isVerified ? <Icon name="check-decagram" size={16} color="primary" accessibilityLabel={t('common:verified')} /> : null}
            </View>
            <View style={styles.metaRow}>
              <RatingStars value={pro.averageRating} count={pro.reviewCount} variant="compact" size={14} textVariant="captionStrong" />
              <AppText variant="caption" color="muted">
                ·
              </AppText>
              <AppText variant="caption" color="secondary" numberOfLines={1} style={styles.shrink}>
                {t('customer:offers.yearsShort', { count: pro.yearsOfExperience })}
              </AppText>
            </View>
          </View>
          <Icon name="chevron-right" size={20} color="muted" flipInRTL />
        </Pressable>

        {highlights.length > 0 && isPending ? (
          <View style={styles.badges}>
            {highlights.map((key) => (
              <Badge
                key={key}
                label={t(`customer:offers.highlights.${key}`)}
                icon={HIGHLIGHT_META[key].icon}
                tone={HIGHLIGHT_META[key].tone}
                size="sm"
              />
            ))}
          </View>
        ) : null}

        <View style={[styles.priceBox, { backgroundColor: theme.colors.surfaceMuted }]}>
          <View style={styles.priceCol}>
            <AppText variant="label" color="muted">
              {t('customer:offers.price')}
            </AppText>
            <PriceText amount={offer.price} currency={offer.currency} variant="title" strikethrough={muted} />
          </View>
          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
          <View style={styles.whenCol}>
            <AppText variant="label" color="muted">
              {t('customer:offers.proposedTime')}
            </AppText>
            <AppText variant="bodyStrong" numberOfLines={1}>
              {format.dateTime(offer.proposedStartAt, { now })}
            </AppText>
            {offer.estimatedDurationMinutes ? (
              <View style={styles.inline}>
                <Icon name="timer-outline" size={14} color="muted" />
                <AppText variant="caption" color="secondary" numberOfLines={1}>
                  {t('customer:offers.duration', { duration: format.duration(offer.estimatedDurationMinutes) })}
                </AppText>
              </View>
            ) : null}
          </View>
        </View>

        {message ? (
          <View style={[styles.message, { borderStartColor: theme.colors.primary }]}>
            <AppText variant="body" color="secondary" numberOfLines={3} userContent>
              {message}
            </AppText>
          </View>
        ) : null}

        <View style={styles.facts}>
          <Fact icon="check-decagram-outline" label={t('common:pro.jobsDone', { count: pro.completedJobsCount })} />
          {typeof offer.distanceKm === 'number' ? (
            <Fact icon="map-marker-distance" label={format.distance(offer.distanceKm, { away: true })} />
          ) : null}
          {pro.city ? <Fact icon="map-marker-outline" label={pro.city} /> : null}
        </View>
      </View>

      <Divider />

      <View style={styles.footer}>
        {isPending ? (
          <>
            <View style={[styles.inline, styles.shrink]}>
              <Icon name="timer-sand" size={15} color={expiresSoon ? 'warning' : 'muted'} />
              <AppText variant="caption" color={expiresSoon ? 'warning' : 'muted'} numberOfLines={2} style={styles.shrink}>
                {expired
                  ? t('common:offerStatus.expired')
                  : t('customer:offers.expires', { time: format.relative(offer.expiresAt, now, { casing: 'inline' }) })}
              </AppText>
            </View>
            {canAccept ? (
              <Button
                label={t('customer:offers.accept')}
                leftIcon="check"
                variant="success"
                size="sm"
                loading={accepting}
                disabled={disabled}
                onPress={onAccept}
                testID={`offer-accept-${offer.id}`}
              />
            ) : null}
          </>
        ) : (
          <View style={styles.statusRow}>
            <OfferStatusBadge status={offer.status} size="sm" />
            {offer.statusReason ? (
              <AppText variant="caption" color="muted" numberOfLines={2} style={styles.shrink}>
                {t(`customer:offers.reasons.${offer.statusReason}`)}
              </AppText>
            ) : null}
          </View>
        )}
      </View>
    </Card>
  );
}

function Fact({ icon, label }: { icon: IconName; label: string }) {
  const styles = useStyles();
  return (
    <View style={styles.inline}>
      <Icon name={icon} size={15} color="muted" />
      <AppText variant="caption" color="secondary" numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  muted: {
    opacity: 0.78,
  },
  acceptedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.sm,
    borderTopStartRadius: t.radii.lg,
    borderTopEndRadius: t.radii.lg,
  },
  body: {
    padding: t.spacing.lg,
    gap: t.spacing.md,
  },
  proRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    minHeight: 48,
  },
  pressed: {
    opacity: 0.7,
  },
  proTexts: {
    flex: 1,
    gap: t.spacing.xxs,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
  },
  shrink: {
    flexShrink: 1,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.spacing.xs,
  },
  priceBox: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: t.radii.md,
    padding: t.spacing.md,
    gap: t.spacing.md,
  },
  priceCol: {
    gap: t.spacing.xxs,
    minWidth: 90,
  },
  divider: {
    width: 1,
  },
  whenCol: {
    flex: 1,
    gap: t.spacing.xxs,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
  },
  message: {
    borderStartWidth: 3,
    paddingStart: t.spacing.md,
    paddingVertical: t.spacing.xxs,
  },
  facts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: t.spacing.lg,
    rowGap: t.spacing.xs,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: t.spacing.md,
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.md,
    minHeight: 60,
  },
  statusRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
  },
}));
