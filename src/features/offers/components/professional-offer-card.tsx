/**
 * The professional's own offer in "My offers": request summary, price, proposed appointment,
 * status (+ reason), expiry countdown and the actions allowed by the offer status machine.
 */
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CategoryIcon } from '@/components/categories';
import { UrgencyBadge } from '@/components/requests';
import { AppText, Button, Card, Divider, Icon, PriceText, Skeleton } from '@/components/ui';
import { getProfessionalOfferActions, getProfessionalOfferOutcome } from '@/features/offers/offer-status-machine';
import { useCategoryName, useFormatters } from '@/i18n/hooks';
import { makeStyles } from '@/theme';
import type { OfferWithRequest } from '@/types/domain';

import { ExpiryBadge } from './expiry-badge';
import { ProfessionalOfferStatusBadge, useOfferReason } from './offer-status-display';

export interface ProfessionalOfferCardProps {
  offer: OfferWithRequest;
  now: Date;
  /** Job created from this offer (accepted offers). */
  jobId?: string | null;
  withdrawing?: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onWithdraw: () => void;
  onViewRequest: () => void;
  onOpenJob: (jobId: string) => void;
  testID?: string;
}

export function ProfessionalOfferCard({
  offer,
  now,
  jobId,
  withdrawing = false,
  onOpen,
  onEdit,
  onWithdraw,
  onViewRequest,
  onOpenJob,
  testID,
}: ProfessionalOfferCardProps) {
  const styles = useStyles();
  const { t } = useTranslation(['offers', 'common']);
  const format = useFormatters();
  const category = useCategoryName(offer.request.categoryId) || t('common:category.unknown');
  const actions = getProfessionalOfferActions(offer, offer.request.status, now);
  const isPending = offer.status === 'pending';
  const outcome = getProfessionalOfferOutcome(offer.status, offer.request.status);
  // A won job (accepted and not cancelled since).
  const isAccepted = outcome === 'accepted';
  const reason = useOfferReason(outcome, offer.statusReason);
  const duration = offer.estimatedDurationMinutes ? format.duration(offer.estimatedDurationMinutes, 'short') : null;

  return (
    // Only the summary opens the offer; the actions below are siblings (never nested in another
    // button, so screen readers reach them and web gets no nested role=button).
    <Card padding="none" highlighted={isAccepted} style={styles.card} testID={testID}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[
          category,
          outcome === 'job_cancelled' ? t('offers:jobCancelled.badge') : t(`common:offerStatus.${offer.status}`),
          format.currency(offer.price, offer.currency),
        ].join(', ')}
        onPress={onOpen}
        style={({ pressed }) => [styles.body, pressed ? styles.pressed : null]}
        testID={testID ? `${testID}-open` : undefined}
      >
        <View style={styles.header}>
          <CategoryIcon categoryId={offer.request.categoryId} size="md" />
          <View style={styles.headerTexts}>
            <AppText variant="subheading" numberOfLines={1}>
              {category}
            </AppText>
            <AppText variant="caption" color="secondary" numberOfLines={2} userContent>
              {offer.request.description}
            </AppText>
          </View>
          <ProfessionalOfferStatusBadge outcome={outcome} size="sm" />
        </View>

        <View style={styles.priceRow}>
          <View style={styles.priceBox}>
            <AppText variant="tiny" color="muted">
              {t('offers:card.yourPrice')}
            </AppText>
            <PriceText amount={offer.price} currency={offer.currency} variant="heading" />
          </View>
          <View style={styles.whenBox}>
            <Icon name="calendar-clock" size={18} color="primary" />
            <View style={styles.shrink}>
              <AppText variant="captionStrong" numberOfLines={1}>
                {format.dateTime(offer.proposedStartAt)}
              </AppText>
              {duration ? (
                <AppText variant="tiny" color="muted" numberOfLines={1}>
                  {t('offers:card.duration', { duration })}
                </AppText>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.metaRow}>
          <UrgencyBadge level={offer.request.urgency} size="sm" />
          {isPending ? <ExpiryBadge expiresAt={offer.expiresAt} /> : null}
          {isPending ? (
            <View style={styles.meta}>
              <Icon name="account-group-outline" size={15} color="muted" />
              <AppText variant="caption" color="muted" numberOfLines={1}>
                {t('offers:card.competition', { count: offer.request.pendingOfferCount })}
              </AppText>
            </View>
          ) : null}
        </View>

        {reason ? (
          <View style={styles.reason}>
            <Icon name={reason.icon} size={16} color={reason.tone} />
            <AppText variant="caption" color="secondary" style={styles.shrink}>
              {reason.text}
            </AppText>
          </View>
        ) : null}
      </Pressable>

      <Divider />
      <View style={styles.footer}>
        {isAccepted && jobId ? (
          <Button
            label={t('offers:actions.goToJob')}
            size="sm"
            variant="success"
            leftIcon="briefcase-check-outline"
            onPress={() => onOpenJob(jobId)}
            style={styles.flexButton}
          />
        ) : null}
        {actions.canEdit ? (
          <Button label={t('offers:actions.edit')} size="sm" variant="secondary" leftIcon="pencil-outline" onPress={onEdit} style={styles.flexButton} />
        ) : null}
        {actions.canWithdraw ? (
          <Button
            label={t('offers:actions.withdraw')}
            size="sm"
            variant="outline"
            leftIcon="undo-variant"
            onPress={onWithdraw}
            loading={withdrawing}
            style={styles.flexButton}
          />
        ) : null}
        {!actions.canEdit && !(isAccepted && jobId) ? (
          <Button
            label={t('offers:actions.viewRequest')}
            size="sm"
            variant="ghost"
            rightIcon="chevron-right"
            flipIconsInRTL
            onPress={onViewRequest}
            style={styles.flexButton}
          />
        ) : null}
      </View>
    </Card>
  );
}

export function ProfessionalOfferCardSkeleton() {
  const styles = useStyles();
  return (
    <Card padding="none">
      <View style={styles.body}>
        <View style={styles.header}>
          <Skeleton width={44} height={44} radius={12} />
          <View style={[styles.headerTexts, styles.skeletonGap]}>
            <Skeleton width="50%" height={14} />
            <Skeleton width="90%" height={11} />
          </View>
          <Skeleton width={72} height={22} radius={999} />
        </View>
        <View style={styles.priceRow}>
          <Skeleton width={90} height={36} />
          <Skeleton width={150} height={36} radius={12} />
        </View>
        <Skeleton width="60%" height={20} radius={999} />
      </View>
      <Divider />
      <View style={styles.footer}>
        <Skeleton width="45%" height={36} radius={8} />
        <Skeleton width="45%" height={36} radius={8} />
      </View>
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  card: {
    overflow: 'hidden',
  },
  body: {
    padding: t.spacing.lg,
    gap: t.spacing.md,
  },
  pressed: {
    backgroundColor: t.colors.surfacePressed,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.spacing.md,
  },
  headerTexts: {
    flex: 1,
    gap: t.spacing.xxs,
  },
  skeletonGap: {
    gap: t.spacing.sm,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: t.spacing.md,
  },
  priceBox: {
    gap: t.spacing.xxs,
  },
  whenBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm,
    borderRadius: t.radii.md,
    backgroundColor: t.colors.primarySoft,
    flexShrink: 1,
  },
  shrink: {
    flexShrink: 1,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: t.spacing.md,
    rowGap: t.spacing.sm,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
  },
  reason: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    padding: t.spacing.sm,
    borderRadius: t.radii.sm,
    backgroundColor: t.colors.surfaceMuted,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.md,
  },
  flexButton: {
    flex: 1,
  },
}));
