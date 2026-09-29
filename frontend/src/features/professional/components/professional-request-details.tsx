/**
 * `/requests/:requestId` for professionals: the job (category, urgency, description, photos), where
 * and for whom, how many offers so far, the professional's own offer and one sticky action (send an
 * offer / view the job).
 */
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button, ErrorState, InlineAlert, Screen, useNow } from '@/components/ui';
import { useWithdrawOfferFlow } from '@/features/offers/components/use-withdraw-offer-flow';
import { getProfessionalOfferOutcome, isOfferActive } from '@/features/offers/offer-status-machine';
import { isRequestOpenForOffers } from '@/features/requests/request-matching';
import { useRefetchOnFocus, useRequest } from '@/hooks';
import { routes } from '@/lib/routes';
import { makeStyles } from '@/theme';
import { isolateText } from '@/utils/bidi';

import { MyOfferCard } from './request-details/my-offer-card';
import { RequestDetailsSkeleton, RequestInfoCard, RequestSummary } from './request-details/request-info';

interface ProfessionalRequestDetailsProps {
  requestId: string;
}

export function ProfessionalRequestDetails({ requestId }: ProfessionalRequestDetailsProps) {
  const styles = useStyles();
  const router = useRouter();
  const { t } = useTranslation(['professional', 'offers', 'common']);
  const now = useNow(30_000);
  const query = useRequest(requestId);
  const { withdraw, pendingOfferId } = useWithdrawOfferFlow();
  useRefetchOnFocus(query.refetch);

  const request = query.data?.viewerRole === 'professional' ? query.data.request : undefined;
  const browse = () => router.navigate(routes.professional.explore);

  if (!request) {
    const failed = query.isError || (query.data && query.data.viewerRole !== 'professional');
    return (
      <Screen
        edges={['left', 'right', 'bottom']}
        footer={failed ? <Button label={t('professional:request.browseOther')} variant="secondary" onPress={browse} fullWidth /> : undefined}
        testID={`ProfessionalRequestDetails-${requestId}`}
      >
        {failed ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} retrying={query.isRefetching} />
        ) : (
          <RequestDetailsSkeleton />
        )}
      </Screen>
    );
  }

  const myOffer = request.myOffer;
  const hasActiveOffer = myOffer !== null && isOfferActive(myOffer.status);
  const acceptsOffers = isRequestOpenForOffers(request);
  const outcome = myOffer ? getProfessionalOfferOutcome(myOffer.status, request.status) : null;
  // Hired and the job still stands (an accepted offer stays accepted after a cancellation).
  const accepted = outcome === 'accepted';
  const canSendOffer = acceptsOffers && !hasActiveOffer;
  const customerNote =
    request.status === 'cancelled' && request.cancellationComment
      ? t('professional:request.banner.customerNote', { note: isolateText(request.cancellationComment) })
      : null;
  const withNote = (message: string) => (customerNote ? `${message}\n${customerNote}` : message);

  let footer = null;
  if (accepted && request.jobId) {
    const jobId = request.jobId;
    footer = <Button label={t('offers:actions.viewJob')} onPress={() => router.push(routes.job(jobId))} fullWidth testID="pro-request-go-to-job" />;
  } else if (canSendOffer) {
    footer = (
      <Button
        label={myOffer ? t('professional:request.sendNew') : t('professional:request.send')}
        onPress={() => router.push(routes.submitOffer(request.id))}
        fullWidth
        testID="pro-request-send-offer"
      />
    );
  } else if (!acceptsOffers && !myOffer) {
    footer = <Button label={t('professional:request.browseOther')} variant="secondary" onPress={browse} fullWidth />;
  }

  return (
    <Screen
      edges={['left', 'right', 'bottom']}
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
      footer={footer}
      contentContainerStyle={styles.content}
      testID={`ProfessionalRequestDetails-${requestId}`}
    >

      {/* Hired: "Your offer · Accepted" and the "View job" button say it all. */}
      {outcome === 'job_cancelled' ? (
        <InlineAlert tone="danger" title={t('offers:jobCancelled.title')} message={withNote(t('offers:jobCancelled.message'))} testID="pro-request-job-cancelled" />
      ) : !acceptsOffers && !accepted ? (
        <InlineAlert
          tone="warning"
          title={t('professional:request.banner.closedTitle')}
          message={withNote(t(`professional:request.banner.closed.${request.status === 'cancelled' ? 'cancelled' : 'taken'}`))}
        />
      ) : null}

      <RequestSummary request={request} showOfferCount={acceptsOffers} />

      {myOffer ? (
        <MyOfferCard
          myOffer={myOffer}
          requestStatus={request.status}
          now={now}
          withdrawing={pendingOfferId === myOffer.offerId}
          onEdit={() => router.push(routes.submitOffer(request.id, myOffer.offerId))}
          onWithdraw={() => void withdraw(myOffer.offerId)}
        />
      ) : null}

      <RequestInfoCard request={request} />
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  content: {
    gap: t.spacing.xxl,
  },
}));
