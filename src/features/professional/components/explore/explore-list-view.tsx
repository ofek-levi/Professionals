/**
 * List mode of the job explorer: infinite list of matching open requests with pull-to-refresh and a
 * sort selector.
 */
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { RequestCard, RequestCardSkeleton } from '@/components/requests';
import { AppText, EmptyState, ErrorState, Icon } from '@/components/ui';
import { useNearbyOpenRequests, useRefetchOnFocus } from '@/hooks';
import { routes } from '@/lib/routes';
import { makeStyles, useTheme } from '@/theme';
import type { NearbyRequestSort } from '@/types/api';

import type { NearbyFilterParams } from '../../explore-filters';
import { SORT_ICONS } from './explore-sort-sheet';

export interface ExploreListViewProps {
  params: NearbyFilterParams;
  sort: NearbyRequestSort;
  onOpenSort: () => void;
  hasFilters: boolean;
  onAdjustFilters: () => void;
  onClearFilters: () => void;
}

export function ExploreListView({ params, sort, onOpenSort, hasFilters, onAdjustFilters, onClearFilters }: ExploreListViewProps) {
  const styles = useStyles();
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation(['explore', 'common']);
  const query = useNearbyOpenRequests({ ...params, sort });
  useRefetchOnFocus(query.refetch);

  const items = query.data?.items ?? [];
  const total = query.data?.totalCount ?? 0;

  const header = (
    <View style={styles.listHeader}>
      <AppText variant="captionStrong" color="secondary" numberOfLines={1} style={styles.flex} tabular>
        {query.data ? t('explore:jobsFound', { count: total }) : ' '}
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('explore:sort.label')}: ${t(`explore:sort.options.${sort}`)}`}
        onPress={onOpenSort}
        hitSlop={8}
        style={({ pressed }) => [styles.sortButton, pressed ? styles.pressed : null]}
        testID="explore-sort-button"
      >
        <Icon name={SORT_ICONS[sort]} size={16} color="primary" />
        <AppText variant="captionStrong" color="primary" numberOfLines={1}>
          {t(`explore:sort.options.${sort}`)}
        </AppText>
        <Icon name="chevron-down" size={16} color="primary" />
      </Pressable>
    </View>
  );

  if (query.data === undefined) {
    return (
      <View style={styles.flex}>
        {query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} retrying={query.isRefetching} />
        ) : (
          <View style={styles.skeletons}>
            {header}
            {[0, 1, 2].map((index) => (
              <RequestCardSkeleton key={index} />
            ))}
          </View>
        )}
      </View>
    );
  }

  return (
    <FlatList
      style={styles.flex}
      contentContainerStyle={styles.content}
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <RequestCard
          variant="professional"
          request={item}
          onPress={() => router.push(routes.request(item.id))}
          testID={`explore-request-${item.id}`}
        />
      )}
      ItemSeparatorComponent={Separator}
      ListHeaderComponent={header}
      ListEmptyComponent={
        <EmptyState
          icon={hasFilters ? 'filter-remove-outline' : 'briefcase-search-outline'}
          title={hasFilters ? t('explore:empty.filteredTitle') : t('explore:empty.areaTitle')}
          description={hasFilters ? t('explore:empty.filteredDescription') : t('explore:empty.areaDescription')}
          actionLabel={hasFilters ? t('explore:empty.adjustFilters') : t('explore:empty.expandArea')}
          actionIcon={hasFilters ? 'tune-variant' : 'map-marker-radius-outline'}
          onAction={hasFilters ? onAdjustFilters : () => router.push(routes.editProfile)}
          secondaryActionLabel={hasFilters ? t('explore:empty.clearFilters') : undefined}
          onSecondaryAction={hasFilters ? onClearFilters : undefined}
        />
      }
      ListFooterComponent={
        query.isFetchingNextPage ? (
          <ActivityIndicator style={styles.footer} color={theme.colors.primary} />
        ) : items.length > 0 && !query.hasNextPage ? (
          <AppText variant="caption" color="muted" align="center" style={styles.footer}>
            {t('explore:list.end')}
          </AppText>
        ) : null
      }
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
      }}
      onEndReachedThreshold={0.4}
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching && !query.isFetchingNextPage}
          onRefresh={() => void query.refetch()}
          tintColor={theme.colors.primary}
          colors={[theme.colors.primary]}
        />
      }
      showsVerticalScrollIndicator={false}
      testID="explore-list"
    />
  );
}

function Separator() {
  const styles = useStyles();
  return <View style={styles.separator} />;
}

const useStyles = makeStyles((t) => ({
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: t.spacing.screen,
    paddingBottom: t.spacing.xxxl,
    flexGrow: 1,
    width: '100%',
    maxWidth: t.layout.maxContentWidth,
    alignSelf: 'center',
  },
  skeletons: {
    paddingHorizontal: t.spacing.screen,
    gap: t.spacing.md,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    paddingTop: t.spacing.md,
    paddingBottom: t.spacing.md,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
    minHeight: 36,
    paddingHorizontal: t.spacing.md,
    borderRadius: t.radii.pill,
    backgroundColor: t.colors.primarySoft,
  },
  pressed: {
    opacity: 0.7,
  },
  separator: {
    height: t.spacing.md,
  },
  footer: {
    paddingVertical: t.spacing.xl,
  },
}));
