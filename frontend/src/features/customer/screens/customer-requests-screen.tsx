/**
 * Requests tab: "Active | Past" segments of compact request cards (active ones ordered by what
 * needs the customer), pull-to-refresh, infinite scroll and a small "+" for a new request.
 * `?tab=active|past` selects the segment.
 */
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { RequestCard, RequestCardSkeleton } from '@/components/requests';
import { EmptyState, ErrorState, IconButton, Screen, ScreenHeader, SegmentedControl, type SegmentedOption } from '@/components/ui';
import { APP_CONFIG } from '@/constants/app-config';
import { useCustomerDashboard, useCustomerRequests, useJobs, useRefetchOnFocus, useRouteParam } from '@/hooks';
import { routes, TAB_PARAM } from '@/lib/routes';
import { makeStyles, useTheme } from '@/theme';
import { isolateText } from '@/utils/bidi';

import {
  appointmentsByRequest,
  parseRequestListTab,
  REQUEST_TAB_STATUSES,
  sortActiveRequests,
  type RequestListTab,
} from '../customer-home-model';
import { hasUnseenOffers, useSeenOffers } from '../seen-offers-store';

export default function CustomerRequestsScreen() {
  const theme = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { t } = useTranslation(['customer', 'common']);
  const tab = parseRequestListTab(useRouteParam(TAB_PARAM));
  const query = useCustomerRequests({ statuses: [...REQUEST_TAB_STATUSES[tab]] });
  // Every active job (at most a few): the appointment line of each request card.
  const jobsQuery = useJobs('active', { pageSize: APP_CONFIG.maxPageSize });
  // Completed jobs still waiting for a review read "Rate CoolAir HVAC", like on Home.
  const dashboardQuery = useCustomerDashboard();
  const seenOffers = useSeenOffers();
  useRefetchOnFocus(query.refetch);

  const items = query.data?.items ?? [];
  const requests = tab === 'active' ? sortActiveRequests(items) : items;
  const appointments = appointmentsByRequest(jobsQuery.data?.items ?? []);
  const toReview = new Map((dashboardQuery.data?.jobsAwaitingReview ?? []).map((job) => [job.requestId, job.professional.displayName]));
  const rateLine = (requestId: string) => {
    const name = toReview.get(requestId);
    return name ? { label: t('customer:home.active.rate', { name: isolateText(name) }), tone: 'warning' as const } : undefined;
  };

  const selectTab = (next: RequestListTab) => router.setParams({ [TAB_PARAM]: next });
  const newRequest = () => router.push(routes.newRequest());

  const tabOptions: SegmentedOption<RequestListTab>[] = [
    { value: 'active', label: t('customer:requests.tabs.active') },
    { value: 'past', label: t('customer:requests.tabs.past') },
  ];

  const header = (
    <View style={styles.header}>
      <ScreenHeader
        title={t('common:tabs.requests')}
        actions={
          <IconButton
            icon="plus"
            variant="surface"
            accessibilityLabel={t('customer:requests.newRequest')}
            onPress={newRequest}
            testID="requests-new"
          />
        }
      />
      <SegmentedControl options={tabOptions} value={tab} onChange={selectTab} testID="requests-tabs" />
    </View>
  );

  const emptyState =
    tab === 'active' ? (
      <EmptyState
        title={t('customer:requests.empty.active.title')}
        description={t('customer:requests.empty.active.description')}
        actionLabel={t('customer:requests.empty.active.action')}
        onAction={newRequest}
      />
    ) : (
      <EmptyState title={t('customer:requests.empty.past.title')} description={t('customer:requests.empty.past.description')} />
    );

  let body;
  if (query.data === undefined) {
    body = query.isError ? (
      <ErrorState error={query.error} onRetry={() => void query.refetch()} retrying={query.isRefetching} />
    ) : (
      <View style={styles.skeletons}>
        <RequestCardSkeleton />
        <RequestCardSkeleton />
        <RequestCardSkeleton />
      </View>
    );
  } else {
    body = (
      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, requests.length === 0 ? styles.emptyContent : null]}
        ItemSeparatorComponent={Separator}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <RequestCard
            variant="customer"
            request={item}
            appointmentAt={appointments.get(item.id) ?? null}
            statusLine={rateLine(item.id)}
            hasNewOffers={hasUnseenOffers(item, seenOffers)}
            onPress={() => router.push(routes.request(item.id))}
            testID={`request-card-${item.id}`}
          />
        )}
        ListEmptyComponent={emptyState}
        ListFooterComponent={
          query.isFetchingNextPage ? <ActivityIndicator color={theme.colors.primary} style={styles.footerSpinner} /> : null
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
        }}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching && !query.isFetchingNextPage}
            onRefresh={() => {
              void query.refetch();
              void jobsQuery.refetch();
              void dashboardQuery.refetch();
            }}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
        testID="customer-requests-list"
      />
    );
  }

  return (
    <Screen scroll={false} padded={false} header={header} testID="customer-requests">
      {body}
    </Screen>
  );
}

function Separator() {
  const styles = useStyles();
  return <View style={styles.separator} />;
}

const useStyles = makeStyles((t) => ({
  header: {
    paddingHorizontal: t.spacing.screen,
    paddingBottom: t.spacing.lg,
  },
  skeletons: {
    gap: t.spacing.md,
    paddingHorizontal: t.spacing.screen,
  },
  listContent: {
    paddingHorizontal: t.spacing.screen,
    paddingBottom: t.spacing.xxxl,
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  separator: {
    height: t.spacing.md,
  },
  footerSpinner: {
    marginVertical: t.spacing.lg,
  },
}));
