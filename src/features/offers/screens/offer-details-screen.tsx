/**
 * `/offers/:offerId` – role aware. Professionals see their offer's status, terms and request with
 * edit / withdraw / go-to-job actions; customers see the professional, the terms and can accept.
 */
import { Stack, useRouter } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ProfessionalSummaryCard } from '@/components/professionals';
import {
  AppText,
  Button,
  Card,
  ErrorState,
  Icon,
  InlineAlert,
  Screen,
  SectionHeader,
  Skeleton,
  SkeletonCard,
  TimeAgo,
  useConfirm,
  useErrorToast,
  useNow,
  useToast,
} from '@/components/ui';
import { useSession } from '@/features/auth/session-provider';
import {
  canCustomerAcceptOffer,
  getProfessionalOfferActions,
  getProfessionalOfferOutcome,
  isOfferExpired,
  type ProfessionalOfferOutcome,
} from '@/features/offers/offer-status-machine';
import { requestAcceptsOffers } from '@/features/requests/request-status-machine';
import { useAcceptOffer, useOffer, useRefetchOnFocus, useRequest, useRouteParam, type OfferDetails } from '@/hooks';
import { useFormatters } from '@/i18n/hooks';
import { routes } from '@/lib/routes';
import { makeStyles } from '@/theme';
import type { UserRole } from '@/types/domain';
import { isolateText } from '@/utils/bidi';

import { ExpiryBadge } from '../components/expiry-badge';
import { OfferRequestSummary } from '../components/offer-request-summary';
import { OfferTerms } from '../components/offer-terms';
import { ProfessionalOfferStatusBadge, useOfferReason } from '../components/offer-status-display';
import { useWithdrawOfferFlow } from '../components/use-withdraw-offer-flow';

export default function OfferDetailsScreen() {
  const { t } = useTranslation(['offers', 'common']);
  const offerId = useRouteParam('offerId');
  const { role } = useSession();
  const query = useOffer(offerId);
  const requestQuery = useRequest(query.data?.requestId);
  useRefetchOnFocus(query.refetch);
  const offer = query.data;
  const jobId = requestQuery.data?.request.jobId ?? null;
  const requestStatus = requestQuery.data?.request.status ?? offer?.request.status;
  const acceptedOfferId = requestQuery.data?.request.acceptedOfferId ?? null;

  if (!offer) {
    return (
      <Screen edges={['left', 'right', 'bottom']} gap="lg" testID="offer-details-loading">
        {query.isError || !offerId ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} retrying={query.isRefetching} />
        ) : (
          <>
            <SkeletonCard />
            <Skeleton height={180} radius={16} />
            <SkeletonCard lines={3} withAvatar={false} />
          </>
        )}
      </Screen>
    );
  }

  const refresh = () => {
    void query.refetch();
    void requestQuery.refetch();
  };

  return role === 'customer' ? (
    <CustomerOfferView
      offer={offer}
      jobId={jobId}
      requestStatus={requestStatus ?? offer.request.status}
      acceptedOfferId={acceptedOfferId}
      refreshing={query.isRefetching}
      onRefresh={refresh}
      title={t('offers:details.customerTitle')}
    />
  ) : (
    <ProfessionalOfferView offer={offer} jobId={jobId} requestStatus={requestStatus ?? offer.request.status} refreshing={query.isRefetching} onRefresh={refresh} title={t('offers:details.proTitle')} />
  );
}

interface OfferViewProps {
  offer: OfferDetails;
  jobId: string | null;
  requestStatus: OfferDetails['request']['status'];
  refreshing: boolean;
  onRefresh: () => void;
  title: string;
}

/** `outcome` is the offer status as its reader sees it (a professional's cancelled job). */
function StatusCard({ offer, outcome, viewer }: { offer: OfferDetails; outcome: ProfessionalOfferOutcome; viewer: UserRole }) {
  const styles = useStyles();
  const { t } = useTranslation(['offers', 'common']);
  const reason = useOfferReason(outcome, offer.statusReason, viewer);
  return (
    <Card padding="lg" style={styles.gap} testID="offer-status-card">
      <View style={styles.statusRow}>
        <ProfessionalOfferStatusBadge outcome={outcome} />
        {offer.status === 'pending' ? <ExpiryBadge expiresAt={offer.expiresAt} /> : null}
      </View>
      {reason ? (
        <View style={styles.inline}>
          <Icon name={reason.icon} size={16} color={reason.tone} />
          <AppText variant="caption" color="secondary" style={styles.flex}>
            {reason.text}
          </AppText>
        </View>
      ) : null}
      <View style={styles.inline}>
        <Icon name="send-clock-outline" size={15} color="muted" />
        <AppText variant="caption" color="muted">
          {t('offers:details.sent')}
        </AppText>
        <AppText variant="caption" color="muted">
          ·
        </AppText>
        <TimeAgo date={offer.createdAt} />
        {offer.updatedAt !== offer.createdAt && offer.status === 'pending' ? (
          <AppText variant="caption" color="muted">
            {t('offers:details.edited')}
          </AppText>
        ) : null}
      </View>
    </Card>
  );
}

function ProfessionalOfferView({ offer, jobId, requestStatus, refreshing, onRefresh, title }: OfferViewProps) {
  const styles = useStyles();
  const router = useRouter();
  const { t } = useTranslation(['offers', 'common']);
  const now = useNow(30_000);
  const { withdraw, pendingOfferId } = useWithdrawOfferFlow();
  const actions = getProfessionalOfferActions(offer, requestStatus, now);
  const outcome = getProfessionalOfferOutcome(offer.status, requestStatus);
  const won = outcome === 'accepted';

  let footer = null;
  if (won && jobId) {
    footer = (
      <Button label={t('offers:actions.goToJob')} size="lg" variant="success" leftIcon="briefcase-check-outline" onPress={() => router.push(routes.job(jobId))} fullWidth testID="offer-go-to-job" />
    );
  } else if (actions.canEdit || actions.canWithdraw) {
    footer = (
      <View style={styles.footerRow}>
        {actions.canWithdraw ? (
          <Button
            label={t('offers:actions.withdraw')}
            variant="outline"
            size="lg"
            leftIcon="undo-variant"
            loading={pendingOfferId === offer.id}
            onPress={() => void withdraw(offer.id)}
            style={styles.flex}
            testID="offer-withdraw"
          />
        ) : null}
        {actions.canEdit ? (
          <Button
            label={t('offers:actions.editOffer')}
            size="lg"
            leftIcon="pencil-outline"
            onPress={() => router.push(routes.submitOffer(offer.requestId, offer.id))}
            style={styles.flex}
            testID="offer-edit"
          />
        ) : null}
      </View>
    );
  }

  return (
    <Screen edges={['left', 'right', 'bottom']} gap="lg" refreshing={refreshing} onRefresh={onRefresh} footer={footer} testID="offer-details-pro">
      <Stack.Screen options={{ title }} />
      {won ? (
        <InlineAlert tone="success" icon="party-popper" title={t('offers:details.acceptedTitle')} message={t('offers:details.acceptedMessage')} />
      ) : outcome === 'job_cancelled' ? (
        <InlineAlert tone="danger" icon="briefcase-remove-outline" title={t('offers:jobCancelled.title')} message={t('offers:jobCancelled.message')} />
      ) : offer.status === 'pending' && !requestAcceptsOffers(requestStatus) ? (
        <InlineAlert tone="warning" message={t('offers:details.requestClosed')} />
      ) : null}
      <StatusCard offer={offer} outcome={outcome} viewer="professional" />
      <Card variant="elevated" padding="lg">
        <OfferTerms
          price={offer.price}
          currency={offer.currency}
          proposedStartAt={offer.proposedStartAt}
          estimatedDurationMinutes={offer.estimatedDurationMinutes}
          message={offer.message}
        />
      </Card>
      <View>
        <SectionHeader title={t('offers:details.request')} icon="clipboard-text-outline" />
        <OfferRequestSummary request={offer.request} onPress={() => router.push(routes.request(offer.requestId))} />
      </View>
    </Screen>
  );
}

function CustomerOfferView({
  offer,
  jobId,
  requestStatus,
  acceptedOfferId,
  refreshing,
  onRefresh,
  title,
}: OfferViewProps & { acceptedOfferId: string | null }) {
  const styles = useStyles();
  const router = useRouter();
  const { t } = useTranslation(['offers', 'common']);
  const format = useFormatters();
  const now = useNow(30_000);
  const confirm = useConfirm();
  const toast = useToast();
  const showError = useErrorToast();
  const accept = useAcceptOffer();
  const expired = isOfferExpired(offer, now);
  const canAccept = canCustomerAcceptOffer(offer, { status: requestStatus, acceptedOfferId }, now);
  const accepted = offer.status === 'accepted';

  const onAccept = async () => {
    const ok = await confirm({
      title: t('offers:accept.title'),
      message: t('offers:accept.message', {
        name: isolateText(offer.professional.displayName),
        price: format.currency(offer.price, offer.currency),
        when: format.dateTime(offer.proposedStartAt),
      }),
      confirmLabel: t('offers:accept.confirm'),
      icon: 'handshake-outline',
      tone: 'success',
    });
    if (!ok) return;
    accept.mutate(offer.id, {
      onSuccess: ({ job }) =>
        toast.show({
          title: t('offers:accept.success'),
          message: t('offers:accept.successMessage', { name: isolateText(offer.professional.displayName) }),
          tone: 'success',
          icon: 'check-circle-outline',
          onPress: () => router.push(routes.job(job.id)),
        }),
      onError: (error) => showError(error),
    });
  };

  let footer = null;
  if (accepted && jobId) {
    footer = <Button label={t('offers:actions.viewJob')} size="lg" variant="success" leftIcon="briefcase-check-outline" onPress={() => router.push(routes.job(jobId))} fullWidth testID="offer-view-job" />;
  } else if (canAccept) {
    footer = (
      <Button
        label={t('offers:accept.button', { price: format.currency(offer.price, offer.currency) })}
        size="lg"
        leftIcon="handshake-outline"
        loading={accept.isPending}
        onPress={() => void onAccept()}
        fullWidth
        testID="offer-accept"
      />
    );
  }

  return (
    <Screen edges={['left', 'right', 'bottom']} gap="lg" refreshing={refreshing} onRefresh={onRefresh} footer={footer} testID="offer-details-customer">
      <Stack.Screen options={{ title }} />
      {offer.status === 'pending' && !canAccept ? (
        <InlineAlert tone="warning" message={expired ? t('offers:details.expiredNotice') : t('offers:details.requestClosedCustomer')} />
      ) : null}
      <ProfessionalSummaryCard
        professional={offer.professional}
        highlightCategoryIds={[offer.request.categoryId]}
        distanceKm={offer.distanceKm}
        onPress={() => router.push(routes.professionalProfile(offer.professional.id))}
        testID="offer-professional"
      />
      <StatusCard offer={offer} outcome={offer.status} viewer="customer" />
      <Card variant="elevated" padding="lg">
        <OfferTerms
          price={offer.price}
          currency={offer.currency}
          proposedStartAt={offer.proposedStartAt}
          estimatedDurationMinutes={offer.estimatedDurationMinutes}
          message={offer.message}
        />
      </Card>
      <View>
        <SectionHeader title={t('offers:details.yourRequest')} icon="clipboard-text-outline" />
        <OfferRequestSummary request={offer.request} onPress={() => router.push(routes.request(offer.requestId))} />
      </View>
      {canAccept ? (
        <View style={styles.inline}>
          <Icon name="shield-check-outline" size={16} color="muted" />
          <AppText variant="caption" color="muted" style={styles.flex}>
            {t('offers:accept.hint')}
          </AppText>
        </View>
      ) : null}
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  gap: {
    gap: t.spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
  },
  flex: {
    flex: 1,
  },
  footerRow: {
    flexDirection: 'row',
    gap: t.spacing.md,
  },
}));
