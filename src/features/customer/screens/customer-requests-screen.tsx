/**
 * "My Requests" tab: requests grouped by lifecycle section (chips with counts), infinite list,
 * pull-to-refresh and a helpful empty state per section.
 */
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, FlatList, Platform, RefreshControl, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { RequestCard, RequestCardSkeleton } from '@/components/requests';
import { Button, Chip, EmptyState, ErrorState, Screen, ScreenHeader, type IconName } from '@/components/ui';
import { CUSTOMER_REQUEST_SECTIONS, type CustomerRequestSection } from '@/constants/request-statuses';
import { useCustomerRequests, useRefetchOnFocus, useRouteParam } from '@/hooks';
import { REQUESTS_SECTION_PARAM, routes } from '@/lib/routes';
import { makeStyles, useTheme } from '@/theme';

import { hasUnseenOffers, useSeenOffers } from '../seen-offers-store';

type SectionFilter = 'all' | CustomerRequestSection;

const FILTERS: readonly SectionFilter[] = ['all', ...CUSTOMER_REQUEST_SECTIONS];

const SECTION_ICONS: Record<SectionFilter, IconName> = {
  all: 'view-list-outline',
  drafts: 'file-document-edit-outline',
  awaiting_offers: 'progress-clock',
  has_offers: 'tag-multiple-outline',
  active: 'progress-wrench',
  completed: 'check-decagram-outline',
  cancelled: 'close-circle-outline',
};

function parseSection(value: string | undefined): SectionFilter {
  return value && (CUSTOMER_REQUEST_SECTIONS as readonly string[]).includes(value) ? (value as CustomerRequestSection) : 'all';
}

const toParams = (section: SectionFilter) => (section === 'all' ? {} : { section });

/** Chip with the live number of requests in its section. */
function SectionChip({
  section,
  selected,
  onPress,
  onLayoutX,
}: {
  section: SectionFilter;
  selected: boolean;
  onPress: () => void;
  onLayoutX: (section: SectionFilter, x: number) => void;
}) {
  const { t } = useTranslation('customer');
  const countQuery = useCustomerRequests({ ...toParams(section), limit: 1 });
  const count = countQuery.data?.totalCount;
  const label = t(`requests.sections.${section}`);
  return (
    <View onLayout={(event) => onLayoutX(section, event.nativeEvent.layout.x)}>
      <Chip
        label={label}
        icon={SECTION_ICONS[section]}
        selected={selected}
        count={count}
        onPress={onPress}
        accessibilityLabel={typeof count === 'number' ? `${label}, ${count}` : label}
        testID={`requests-section-${section}`}
      />
    </View>
  );
}

export default function CustomerRequestsScreen() {
  const theme = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { t } = useTranslation(['customer', 'common']);
  const section = parseSection(useRouteParam(REQUESTS_SECTION_PARAM));
  const query = useCustomerRequests(toParams(section));
  const seenOffers = useSeenOffers();
  const chipsRef = useRef<ScrollView>(null);
  const chipPositions = useRef(new Map<SectionFilter, number>());
  useRefetchOnFocus(query.refetch);

  // Keep the selected section chip in view (e.g. when opened from a home tile).
  // Web RTL scroll offsets are negative, so the automatic scroll is skipped there.
  const canAutoScroll = !(Platform.OS === 'web' && theme.isRTL);
  const scrollToChip = (x: number, animated: boolean) => {
    if (canAutoScroll) chipsRef.current?.scrollTo({ x: Math.max(0, x - theme.spacing.screen), animated });
  };
  const handleChipLayout = (key: SectionFilter, x: number) => {
    chipPositions.current.set(key, x);
    if (key === section) scrollToChip(x, false);
  };
  useEffect(() => {
    const x = chipPositions.current.get(section);
    if (x !== undefined && canAutoScroll) chipsRef.current?.scrollTo({ x: Math.max(0, x - theme.spacing.screen), animated: true });
  }, [section, canAutoScroll, theme.spacing.screen]);

  const selectSection = (next: SectionFilter) => {
    router.setParams({ [REQUESTS_SECTION_PARAM]: next === 'all' ? undefined : next });
  };
  const newRequest = () => router.push(routes.newRequest());
  const items = query.data?.items ?? [];

  const header = (
    <View>
      <View style={styles.headerPadding}>
        <ScreenHeader
          title={t('common:tabs.requests')}
          subtitle={t('customer:requests.subtitle')}
          actions={
            <Button label={t('customer:requests.newRequest')} leftIcon="plus" size="sm" shape="pill" onPress={newRequest} testID="requests-new" />
          }
        />
      </View>
      <ScrollView ref={chipsRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {FILTERS.map((filter) => (
          <SectionChip
            key={filter}
            section={filter}
            selected={filter === section}
            onPress={() => selectSection(filter)}
            onLayoutX={handleChipLayout}
          />
        ))}
      </ScrollView>
    </View>
  );

  const emptyState = (
    <EmptyState
      icon={SECTION_ICONS[section]}
      title={t(`customer:requests.empty.${section}.title`)}
      description={t(`customer:requests.empty.${section}.description`)}
      actionLabel={t('customer:requests.newRequest')}
      actionIcon="plus"
      onAction={newRequest}
      secondaryActionLabel={section !== 'all' ? t('customer:requests.showAll') : undefined}
      onSecondaryAction={section !== 'all' ? () => selectSection('all') : undefined}
    />
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
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, items.length === 0 ? styles.emptyContent : null]}
        ItemSeparatorComponent={Separator}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <RequestCard
            variant="customer"
            request={item}
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
            onRefresh={() => void query.refetch()}
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
  headerPadding: {
    paddingHorizontal: t.spacing.screen,
  },
  chips: {
    gap: t.spacing.sm,
    paddingHorizontal: t.spacing.screen,
    paddingBottom: t.spacing.md,
  },
  skeletons: {
    gap: t.spacing.md,
    paddingHorizontal: t.spacing.screen,
    paddingTop: t.spacing.xs,
  },
  listContent: {
    paddingHorizontal: t.spacing.screen,
    paddingTop: t.spacing.xs,
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
