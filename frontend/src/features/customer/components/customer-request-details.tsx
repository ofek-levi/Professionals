/**
 * The customer's view of one of their requests, status first: what's happening, the request
 * itself, then the offers to decide on – or, once an offer is accepted, just the hired pro.
 * Cancelling is a quiet action at the bottom; a draft can be continued or deleted, and a cancelled
 * request can be requested again (a new request for the same service).
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, EmptyState, ErrorState, InlineAlert, Screen, useConfirm, useErrorToast, useToast } from '@/components/ui';
import { requestStatusMeta } from '@/constants/request-statuses';
import { getCustomerRequestActions } from '@/features/requests/request-status-machine';
import { useDeleteDraftRequest, useJob, useRefetchOnFocus, useRequest } from '@/hooks';
import { routes } from '@/lib/routes';
import { makeStyles } from '@/theme';
import type { CustomerRequestView } from '@/types/domain';

import { CancelRequestSheet } from './request-details/cancel-request-sheet';
import { HiredProCard } from './request-details/hired-pro-card';
import { OffersSection } from './request-details/offers-section';
import { RequestSummary, RequestSummarySkeleton } from './request-details/request-summary';

interface CustomerRequestDetailsProps {
  requestId: string;
  /** Opened right after posting: shows the one-time "Request posted" banner. */
  justPosted?: boolean;
}

export function CustomerRequestDetails({ requestId, justPosted = false }: CustomerRequestDetailsProps) {
  const router = useRouter();
  const { t } = useTranslation('common');
  const requestQuery = useRequest(requestId);
  const data = requestQuery.data;
  const request = data?.viewerRole === 'customer' ? data.request : undefined;

  if (!request) {
    return (
      <Screen edges={['left', 'right', 'bottom']} testID={`CustomerRequestDetails-${requestId}`}>
        {requestQuery.isError ? (
          <ErrorState error={requestQuery.error} onRetry={() => void requestQuery.refetch()} retrying={requestQuery.isRefetching} />
        ) : data ? (
          <EmptyState
            title={t('states.notFoundTitle')}
            description={t('states.notFoundDescription')}
            actionLabel={t('screens.goHome')}
            onAction={() => router.replace(routes.customer.home)}
          />
        ) : (
          <RequestSummarySkeleton />
        )}
      </Screen>
    );
  }

  return <RequestDetailsContent request={request} justPosted={justPosted} />;
}

function RequestDetailsContent({ request, justPosted }: { request: CustomerRequestView; justPosted: boolean }) {
  const styles = useStyles();
  const router = useRouter();
  const { t } = useTranslation(['customer', 'common']);
  const confirm = useConfirm();
  const toast = useToast();
  const showError = useErrorToast();
  const requestQuery = useRequest(request.id);
  const jobQuery = useJob(request.jobId);
  const deleteDraft = useDeleteDraftRequest();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(justPosted);
  const [refreshSignal, setRefreshSignal] = useState(0);
  useRefetchOnFocus(requestQuery.refetch);

  const actions = getCustomerRequestActions(request);
  const isDraft = request.status === 'draft';
  const acceptsOffers = requestStatusMeta(request.status).acceptsOffers;
  const job = jobQuery.data;
  const showHiredPro = Boolean(request.jobId) && request.status !== 'cancelled';

  const refresh = () => {
    setRefreshSignal((value) => value + 1);
    return Promise.all([requestQuery.refetch(), request.jobId ? jobQuery.refetch() : null]);
  };

  const confirmDeleteDraft = async () => {
    const confirmed = await confirm({
      title: t('customer:details.draft.deleteConfirmTitle'),
      message: t('customer:details.draft.deleteConfirmMessage'),
      confirmLabel: t('common:actions.delete'),
      destructive: true,
    });
    if (!confirmed) return;
    deleteDraft.mutate(request.id, {
      onSuccess: () => {
        toast.show({ title: t('customer:details.draft.deleted'), tone: 'neutral' });
        if (router.canGoBack()) router.back();
        else router.replace(routes.customer.requests);
      },
      onError: (error) => showError(error),
    });
  };

  const footer =
    isDraft && actions.canEditDraft ? (
      <Button
        label={t('customer:details.draft.continue')}
        fullWidth
        disabled={deleteDraft.isPending}
        onPress={() => router.push(routes.newRequest({ draftId: request.id }))}
        testID="draft-continue"
      />
    ) : undefined;

  return (
    <Screen
      edges={['left', 'right', 'bottom']}
      onRefresh={refresh}
      footer={footer}
      testID={`CustomerRequestDetails-${request.id}`}
    >
      <View style={styles.body}>
        {bannerVisible && acceptsOffers ? (
          <InlineAlert
            tone="success"
            message={t('customer:details.postedBanner')}
            onDismiss={() => setBannerVisible(false)}
            testID="request-posted-banner"
          />
        ) : null}

        <RequestSummary request={request} job={job} />

        {showHiredPro ? (
          <HiredProCard job={job} error={jobQuery.error} loading={jobQuery.isPending} onRetry={() => void jobQuery.refetch()} />
        ) : acceptsOffers ? (
          <OffersSection request={request} refreshSignal={refreshSignal} />
        ) : null}

        {isDraft && actions.canDeleteDraft ? (
          <Button
            label={t('customer:details.draft.delete')}
            variant="dangerGhost"
            loading={deleteDraft.isPending}
            onPress={() => void confirmDeleteDraft()}
            style={styles.quietAction}
            testID="draft-delete"
          />
        ) : null}

        {request.status === 'cancelled' ? (
          <Button
            label={t('customer:details.requestAgain')}
            variant="ghost"
            onPress={() => router.push(routes.newRequest({ categoryId: request.categoryId }))}
            style={styles.quietAction}
            testID="request-again"
          />
        ) : null}

        {actions.canCancel && !isDraft ? (
          <Button
            label={t('customer:details.cancelRequest')}
            variant="dangerGhost"
            onPress={() => setCancelOpen(true)}
            style={styles.quietAction}
            testID="request-cancel"
          />
        ) : null}
      </View>

      <CancelRequestSheet request={request} visible={cancelOpen} onClose={() => setCancelOpen(false)} />
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  body: {
    gap: t.layout.sectionGap,
  },
  quietAction: {
    alignSelf: 'center',
  },
}));
