/**
 * "My Requests" tab: requests grouped by lifecycle section (chips with counts), infinite list,
 * pull-to-refresh and a helpful empty state per section.
 */
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, RefreshControl, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { RequestCard, RequestCardSkeleton } from '@/components/requests';
import { Button, Chip, EmptyState, ErrorState, Screen, ScreenHeader, type IconName } from '@/components/ui';
import { CUSTOMER_REQUEST_SECTIONS, type CustomerRequestSection } from '@/constants/request-statuses';
import { useCustomerRequests, useRefetchOnFocus, useRouteParam } from '@/hooks';
import { REQUESTS_SECTION_PARAM, routes } from '@/lib/routes';
import { makeStyles, useTheme } from '@/theme';
import { horizontalScrollOffset, itemStartOffset } from '@/utils/scroll';

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

interface ChipLayout {
  x: number;
  width: number;
}

const toParams = (section: SectionFilter) => (section === 'all' ? {} : { section });

/** Chip with the live number of requests in its section. */
function SectionChip({
  section,
  selected,
  onPress,
  onLayoutChip,
}: {
  section: SectionFilter;
  selected: boolean;
  onPress: () => void;
  onLayoutChip: (section: SectionFilter, layout: ChipLayout) => void;
}) {
  const { t } = useTranslation('customer');
  const countQuery = useCustomerRequests({ ...toParams(section), limit: 1 });
  const count = countQuery.data?.totalCount;
  const label = t(`requests.sections.${section}`);
  return (
    <View onLayout={(event) => onLayoutChip(section, { x: event.nativeEvent.layout.x, width: event.nativeEvent.layout.width })}>
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
  const [chipLayouts, setChipLayouts] = useState<Partial<Record<SectionFilter, ChipLayout>>>({});
  const [chipsSize, setChipsSize] = useState({ content: 0, viewport: 0 });
  useRefetchOnFocus(query.refetch);

  // Keep the selected section chip in view (e.g. when opened from a home tile), in both directions.
  const rtlWeb = Platform.OS === 'web' && theme.isRTL;
  const padding = theme.spacing.screen;
  const chipGap = theme.spacing.sm;
  const handleChipLayout = (key: SectionFilter, layout: ChipLayout) => {
    setChipLayouts((all) => {
      const known = all[key];
      return known && known.x === layout.x && known.width === layout.width ? all : { ...all, [key]: layout };
    });
  };
  const lastScrolled = useRef<SectionFilter | null>(null);
  useEffect(() => {
    const index = FILTERS.indexOf(section);
    const widths = FILTERS.map((filter) => chipLayouts[filter]?.width);
    const selectedLayout = chipLayouts[section];
    if (!selectedLayout || widths.slice(0, index).some((width) => width === undefined)) return;
    if (chipsSize.content === 0 || chipsSize.viewport === 0) return;
    // React Native Web only reports size changes to onLayout, so a chip's x goes stale when a chip
    // before it grows (e.g. when its count loads): on the web the position is derived from widths.
    const startOffset =
      Platform.OS === 'web' ? itemStartOffset(widths.map((width) => width ?? 0), index, chipGap, padding) : selectedLayout.x;
    const x = horizontalScrollOffset({ startOffset, contentWidth: chipsSize.content, viewportWidth: chipsSize.viewport, padding, rtlWeb });
    // Opening the screen on a section jumps there; switching sections afterwards animates.
    chipsRef.current?.scrollTo({ x, animated: lastScrolled.current !== null && lastScrolled.current !== section });
    lastScrolled.current = section;
  }, [section, chipLayouts, chipsSize, chipGap, padding, rtlWeb]);

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
      <ScrollView
        ref={chipsRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        onLayout={(event) => {
          const viewport = event.nativeEvent.layout.width;
          setChipsSize((size) => (size.viewport === viewport ? size : { ...size, viewport }));
        }}
        onContentSizeChange={(content) => setChipsSize((size) => (size.content === content ? size : { ...size, content }))}
      >
        {FILTERS.map((filter) => (
          <SectionChip
            key={filter}
            section={filter}
            selected={filter === section}
            onPress={() => selectSection(filter)}
            onLayoutChip={handleChipLayout}
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
  // Keep in sync with the chip scroll math (gap / start padding) in CustomerRequestsScreen.
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
