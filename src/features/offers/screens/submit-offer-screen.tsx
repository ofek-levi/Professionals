/**
 * `/requests/:requestId/offer?offerId=` – send a new offer, or edit a pending one (`offerId`).
 * Loads the request (and the offer when editing) and guards the cases where no form makes sense.
 */
import { Stack, useRouter } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState, ErrorState, Screen, Skeleton, SkeletonCard, useNow } from '@/components/ui';
import { getProfessionalOfferActions, isOfferActive } from '@/features/offers/offer-status-machine';
import { isRequestOpenForOffers } from '@/features/requests/request-matching';
import { useOffer, useOwnProfessionalProfile, useRequest, useRouteParam } from '@/hooks';
import { routes } from '@/lib/routes';
import { makeStyles } from '@/theme';

import { OfferForm } from '../components/offer-form/offer-form';

export default function SubmitOfferScreen() {
  const styles = useStyles();
  const router = useRouter();
  const { t } = useTranslation(['offers', 'common']);
  const now = useNow(60_000);
  const requestId = useRouteParam('requestId');
  const offerId = useRouteParam('offerId') ?? null;
  const requestQuery = useRequest(requestId);
  const offerQuery = useOffer(offerId);
  const profileQuery = useOwnProfessionalProfile();

  const title = offerId ? t('offers:form.editTitle') : t('common:screens.submitOffer');
  const header = <Stack.Screen options={{ title }} />;
  const request = requestQuery.data?.viewerRole === 'professional' ? requestQuery.data.request : undefined;
  const offer = offerId ? offerQuery.data : null;

  const failed = requestQuery.isError ? requestQuery.error : offerId && offerQuery.isError ? offerQuery.error : null;
  if (!requestId || failed || (requestQuery.data && !request)) {
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        {header}
        <ErrorState
          error={failed}
          onRetry={() => {
            void requestQuery.refetch();
            if (offerId) void offerQuery.refetch();
          }}
        />
      </Screen>
    );
  }

  if (!request || offer === undefined || (profileQuery.isPending && !profileQuery.isError)) {
    return (
      <Screen edges={['left', 'right', 'bottom']} gap="lg">
        {header}
        <SkeletonCard />
        <View style={styles.skeleton}>
          <Skeleton width="40%" height={18} />
          <Skeleton height={52} radius={12} />
        </View>
        <View style={styles.skeleton}>
          <Skeleton width="50%" height={18} />
          <Skeleton height={64} radius={12} />
          <Skeleton height={120} radius={12} />
        </View>
      </Screen>
    );
  }

  // Editing an offer that can no longer change (accepted, withdrawn, expired, request closed…).
  if (offer && !getProfessionalOfferActions(offer, offer.request.status, now).canEdit) {
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        {header}
        <EmptyState
          icon="lock-outline"
          title={t('offers:form.locked.title')}
          description={t('offers:form.locked.description')}
          actionLabel={t('offers:actions.viewOffer')}
          onAction={() => router.dismissTo(routes.offer(offer.id))}
          secondaryActionLabel={t('offers:actions.viewRequest')}
          onSecondaryAction={() => router.dismissTo(routes.request(request.id))}
        />
      </Screen>
    );
  }

  if (!offer) {
    const myOffer = request.myOffer;
    if (myOffer && isOfferActive(myOffer.status)) {
      return (
        <Screen edges={['left', 'right', 'bottom']}>
          {header}
          <EmptyState
            icon="tag-check-outline"
            title={t('offers:form.duplicate.title')}
            description={t('offers:form.duplicate.description')}
            actionLabel={myOffer.status === 'pending' ? t('offers:form.duplicate.edit') : t('offers:actions.viewOffer')}
            onAction={() =>
              myOffer.status === 'pending'
                ? router.replace(routes.submitOffer(request.id, myOffer.offerId))
                : router.dismissTo(routes.offer(myOffer.offerId))
            }
          />
        </Screen>
      );
    }
    if (!isRequestOpenForOffers(request)) {
      return (
        <Screen edges={['left', 'right', 'bottom']}>
          {header}
          <EmptyState
            icon="lock-outline"
            tone="warning"
            title={t('offers:form.closed.title')}
            description={t('offers:form.closed.description')}
            actionLabel={t('offers:form.closed.browse')}
            onAction={() => router.dismissTo(routes.professional.explore)}
          />
        </Screen>
      );
    }
  }

  return (
    <>
      {header}
      <OfferForm key={offer?.id ?? request.id} request={request} offer={offer} profile={profileQuery.data} />
    </>
  );
}

const useStyles = makeStyles((t) => ({
  skeleton: {
    gap: t.spacing.md,
    padding: t.spacing.lg,
    borderRadius: t.radii.lg,
    backgroundColor: t.colors.surface,
  },
}));
