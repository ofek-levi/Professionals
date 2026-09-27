/**
 * The customer's view of one of their requests: overview, progress, logistics, the hired
 * professional and – the core of the experience – the offers to compare and accept.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Card, EmptyState, ErrorState, InlineAlert, ListItem, Screen, useConfirm, useErrorToast, useToast } from '@/components/ui';
import { getCustomerRequestActions } from '@/features/requests/request-status-machine';
import { useDeleteDraftRequest, useJob, usePublishRequest, useRefetchOnFocus, useRequest } from '@/hooks';
import { useFormatters } from '@/i18n/hooks';
import { routes } from '@/lib/routes';
import { makeStyles } from '@/theme';
import type { CustomerRequestView } from '@/types/domain';

import { CancelRequestSheet } from './request-details/cancel-request-sheet';
import { OffersSection } from './request-details/offers-section';
import { RequestDetailsSkeleton, RequestLogisticsCard, RequestOverviewCard } from './request-details/request-summary-cards';
import { RequestTimelineCard } from './request-details/request-timeline-card';
import { SelectedProCard } from './request-details/selected-pro-card';

export interface CustomerRequestDetailsProps {
  requestId: string;
}

export function CustomerRequestDetails({ requestId }: CustomerRequestDetailsProps) {
  const router = useRouter();
  const { t } = useTranslation(['customer', 'common']);
  const requestQuery = useRequest(requestId);
  const data = requestQuery.data;
  const request = data?.viewerRole === 'customer' ? data.request : undefined;
  const jobQuery = useJob(request?.jobId ?? null);
  const [refreshSignal, setRefreshSignal] = useState(0);
  useRefetchOnFocus(requestQuery.refetch);

  const refresh = () => {
    void requestQuery.refetch();
    if (request?.jobId) void jobQuery.refetch();
    setRefreshSignal((value) => value + 1);
  };

  if (!request) {
    return (
      <Screen edges={['left', 'right', 'bottom']} testID={`CustomerRequestDetails-${requestId}`}>
        {requestQuery.isError ? (
          <ErrorState error={requestQuery.error} onRetry={() => void requestQuery.refetch()} retrying={requestQuery.isRefetching} />
        ) : data ? (
          <EmptyState
            icon="file-search-outline"
            title={t('common:states.notFoundTitle')}
            description={t('common:states.notFoundDescription')}
            actionLabel={t('common:screens.goHome')}
            onAction={() => router.replace(routes.customer.home)}
          />
        ) : (
          <RequestDetailsSkeleton />
        )}
      </Screen>
    );
  }

  return (
    <RequestDetailsContent
      request={request}
      job={jobQuery.data}
      jobError={jobQuery.error}
      jobLoading={jobQuery.isPending}
      onRetryJob={() => void jobQuery.refetch()}
      refreshing={requestQuery.isRefetching}
      onRefresh={refresh}
      refreshSignal={refreshSignal}
    />
  );
}

interface ContentProps {
  request: CustomerRequestView;
  job: ReturnType<typeof useJob>['data'];
  jobError: unknown;
  jobLoading: boolean;
  onRetryJob: () => void;
  refreshing: boolean;
  onRefresh: () => void;
  refreshSignal: number;
}

function RequestDetailsContent({ request, job, jobError, jobLoading, onRetryJob, refreshing, onRefresh, refreshSignal }: ContentProps) {
  const styles = useStyles();
  const router = useRouter();
  const { t } = useTranslation(['customer', 'common']);
  const confirm = useConfirm();
  const toast = useToast();
  const showError = useErrorToast();
  const format = useFormatters();
  const publish = usePublishRequest();
  const deleteDraft = useDeleteDraftRequest();
  const [cancelOpen, setCancelOpen] = useState(false);
  const actions = getCustomerRequestActions(request);
  const isDraft = request.status === 'draft';
  const hasJob = Boolean(request.jobId);
  const busy = publish.isPending || deleteDraft.isPending;

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace(routes.customer.requests);
  };

  const confirmPublish = async () => {
    const confirmed = await confirm({
      title: t('customer:details.draft.publishConfirmTitle'),
      message: t('customer:details.draft.publishConfirmMessage'),
      confirmLabel: t('customer:details.draft.publish'),
      icon: 'send-outline',
      tone: 'brand',
    });
    if (!confirmed) return;
    publish.mutate(request.id, {
      onSuccess: () =>
        toast.show({ title: t('customer:details.draft.published'), message: t('customer:details.draft.publishedMessage'), tone: 'success' }),
      onError: (error) => showError(error),
    });
  };

  const confirmDelete = async () => {
    const confirmed = await confirm({
      title: t('customer:details.draft.deleteConfirmTitle'),
      message: t('customer:details.draft.deleteConfirmMessage'),
      confirmLabel: t('common:actions.delete'),
      destructive: true,
      icon: 'trash-can-outline',
    });
    if (!confirmed) return;
    deleteDraft.mutate(request.id, {
      onSuccess: () => {
        toast.show({ title: t('customer:details.draft.deleted'), tone: 'neutral', icon: 'trash-can-outline' });
        leave();
      },
      onError: (error) => showError(error),
    });
  };

  const draftFooter = isDraft ? (
    <View style={styles.footer}>
      {actions.canPublish ? (
        <Button
          label={t('customer:details.draft.publish')}
          leftIcon="send-outline"
          flipIconsInRTL
          fullWidth
          size="lg"
          loading={publish.isPending}
          disabled={busy}
          onPress={() => void confirmPublish()}
          testID="draft-publish"
        />
      ) : null}
      <View style={styles.footerRow}>
        {actions.canEditDraft ? (
          <Button
            label={t('customer:details.draft.edit')}
            leftIcon="pencil-outline"
            variant="secondary"
            style={styles.flex}
            disabled={busy}
            onPress={() => router.push(routes.newRequest({ draftId: request.id }))}
            testID="draft-edit"
          />
        ) : null}
        {actions.canDeleteDraft ? (
          <Button
            label={t('common:actions.delete')}
            leftIcon="trash-can-outline"
            variant="outline"
            style={styles.flex}
            loading={deleteDraft.isPending}
            disabled={busy}
            onPress={() => void confirmDelete()}
            testID="draft-delete"
          />
        ) : null}
      </View>
    </View>
  ) : undefined;

  const offers = !isDraft ? <OffersSection request={request} refreshSignal={refreshSignal} /> : null;
  const timeline = !isDraft ? <RequestTimelineCard request={request} job={job ?? null} /> : null;

  return (
    <Screen
      edges={['left', 'right', 'bottom']}
      gap="xl"
      refreshing={refreshing}
      onRefresh={onRefresh}
      footer={draftFooter}
      testID={`CustomerRequestDetails-${request.id}`}
    >
      <RequestOverviewCard request={request} />

      {request.status === 'cancelled' ? (
        <InlineAlert
          tone="danger"
          icon="close-circle-outline"
          title={t('customer:details.cancelledTitle')}
          message={
            request.cancellationReason
              ? t('customer:details.cancelledMessageWithReason', {
                  date: format.dateTime(request.cancelledAt ?? request.updatedAt, { casing: 'inline' }),
                  reason: t(`common:cancellationReason.${request.cancellationReason}`),
                })
              : t('customer:details.cancelledMessage', { date: format.dateTime(request.cancelledAt ?? request.updatedAt, { casing: 'inline' }) })
          }
        />
      ) : null}

      {isDraft ? (
        <InlineAlert tone="warning" icon="file-document-edit-outline" title={t('customer:details.draft.title')} message={t('customer:details.draft.message')} />
      ) : null}

      {hasJob ? <SelectedProCard job={job} error={jobError} loading={jobLoading} onRetry={onRetryJob} /> : null}

      {hasJob || request.status === 'cancelled' ? (
        <>
          {timeline}
          <RequestLogisticsCard request={request} />
          {offers}
        </>
      ) : (
        <>
          {offers}
          {timeline}
          <RequestLogisticsCard request={request} />
        </>
      )}

      {actions.canCancel && !isDraft ? (
        <Card padding="none" style={styles.cancelCard}>
          <ListItem
            icon="close-circle-outline"
            destructive
            title={t('customer:details.cancelRequest')}
            subtitle={t('customer:details.cancelHint')}
            onPress={() => setCancelOpen(true)}
            testID="request-cancel"
          />
        </Card>
      ) : null}

      <CancelRequestSheet request={request} visible={cancelOpen} onClose={() => setCancelOpen(false)} />
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  footer: {
    gap: t.spacing.sm,
  },
  footerRow: {
    flexDirection: 'row',
    gap: t.spacing.sm,
  },
  flex: {
    flex: 1,
  },
  cancelCard: {
    paddingHorizontal: t.spacing.lg,
  },
}));
