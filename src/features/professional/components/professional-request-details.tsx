/**
 * `/requests/:requestId` for professionals: the job, approximate location, customer, competition,
 * the professional's own offer and a sticky CTA (send an offer / go to job).
 */
import { Stack, useRouter } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, ErrorState, InlineAlert, Screen, SectionHeader, useNow } from '@/components/ui';
import { useWithdrawOfferFlow } from '@/features/offers/components/use-withdraw-offer-flow';
import { getProfessionalOfferOutcome, isOfferActive } from '@/features/offers/offer-status-machine';
import { isRequestOpenForOffers } from '@/features/requests/request-matching';
import { useRefetchOnFocus, useRequest } from '@/hooks';
import { useCategoryName } from '@/i18n/hooks';
import { routes } from '@/lib/routes';
import { makeStyles } from '@/theme';
import { isolateText } from '@/utils/bidi';

import { ApproximateLocationCard } from './request-details/approximate-location-card';
import { MyOfferCard } from './request-details/my-offer-card';
import {
  CompetitionCard,
  CustomerCard,
  RequestDescriptionCard,
  RequestDetailsSkeleton,
  RequestHeaderCard,
} from './request-details/request-info-cards';

export interface ProfessionalRequestDetailsProps {
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
  const categoryName = useCategoryName(request?.categoryId);

  if (!request) {
    return (
      <Screen edges={['left', 'right', 'bottom']} testID={`ProfessionalRequestDetails-${requestId}`}>
        {/* The shared route title is customer wording; professionals get their own ("קריאה"). */}
        <Stack.Screen options={{ title: t('professional:request.screenTitle') }} />
        {query.isError || (query.data && query.data.viewerRole !== 'professional') ? (
          <>
            <ErrorState error={query.error} onRetry={() => void query.refetch()} retrying={query.isRefetching} />
            <Button
              label={t('professional:request.browseOther')}
              variant="secondary"
              leftIcon="map-search-outline"
              onPress={() => router.push(routes.professional.explore)}
              style={styles.centered}
            />
          </>
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
  const customerNote = request.status === 'cancelled' && request.cancellationComment
    ? t('professional:request.banner.customerNote', { note: isolateText(request.cancellationComment) })
    : null;
  const withNote = (message: string) => (customerNote ? `${message}\n${customerNote}` : message);

  let footer = null;
  if (accepted && request.jobId) {
    const jobId = request.jobId;
    footer = (
      <Button
        label={t('offers:actions.goToJob')}
        variant="success"
        size="lg"
        leftIcon="briefcase-check-outline"
        onPress={() => router.push(routes.job(jobId))}
        fullWidth
        testID="pro-request-go-to-job"
      />
    );
  } else if (canSendOffer) {
    footer = (
      <Button
        label={myOffer ? t('professional:request.cta.sendNew') : t('professional:request.cta.send')}
        size="lg"
        leftIcon="tag-plus-outline"
        onPress={() => router.push(routes.submitOffer(request.id))}
        fullWidth
        testID="pro-request-send-offer"
      />
    );
  }

  return (
    <Screen
      edges={['left', 'right', 'bottom']}
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
      footer={footer}
      gap="lg"
      testID={`ProfessionalRequestDetails-${requestId}`}
    >
      {categoryName ? <Stack.Screen options={{ title: categoryName }} /> : null}

      {accepted ? (
        <InlineAlert
          tone="success"
          icon="party-popper"
          title={t('professional:request.banner.acceptedTitle')}
          message={t('professional:request.banner.acceptedMessage', { customer: isolateText(request.customer.displayName) })}
        />
      ) : outcome === 'job_cancelled' ? (
        <InlineAlert
          tone="danger"
          icon="briefcase-remove-outline"
          title={t('offers:jobCancelled.title')}
          message={withNote(t('offers:jobCancelled.message'))}
          testID="pro-request-job-cancelled"
        />
      ) : !acceptsOffers ? (
        <InlineAlert
          tone="warning"
          icon="lock-outline"
          title={t('professional:request.banner.closedTitle')}
          message={withNote(t(`professional:request.banner.closed.${request.status === 'cancelled' ? 'cancelled' : 'taken'}`))}
        />
      ) : null}

      <RequestHeaderCard request={request} />

      {myOffer ? (
        <MyOfferCard
          myOffer={myOffer}
          requestStatus={request.status}
          jobId={request.jobId}
          now={now}
          withdrawing={pendingOfferId === myOffer.offerId}
          onEdit={() => router.push(routes.submitOffer(request.id, myOffer.offerId))}
          onWithdraw={() => void withdraw(myOffer.offerId)}
          onViewOffer={() => router.push(routes.offer(myOffer.offerId))}
          onOpenJob={(jobId) => router.push(routes.job(jobId))}
        />
      ) : null}

      <RequestDescriptionCard request={request} />

      <View>
        <SectionHeader title={t('professional:request.location.title')} icon="map-marker-outline" />
        <ApproximateLocationCard location={request.location} distanceKm={request.distanceKm} />
      </View>

      <View>
        <SectionHeader title={t('professional:request.customer.title')} icon="account-outline" />
        <CustomerCard customer={request.customer} />
      </View>

      {acceptsOffers && !accepted ? <CompetitionCard request={request} hasOwnPendingOffer={myOffer?.status === 'pending'} /> : null}

      {!acceptsOffers && !myOffer ? (
        <Button
          label={t('professional:request.browseOther')}
          variant="secondary"
          leftIcon="map-search-outline"
          onPress={() => router.push(routes.professional.explore)}
          fullWidth
          style={styles.browse}
        />
      ) : null}
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  browse: {
    marginTop: t.spacing.sm,
  },
  centered: {
    alignSelf: 'center',
  },
}));
