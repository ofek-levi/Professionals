/**
 * List mode of the job explorer: infinite list of matching open requests (newest first) with
 * pull-to-refresh.
 */
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { RequestCard, RequestCardSkeleton } from '@/components/requests';
import { EmptyState, ErrorState, usePullToRefresh } from '@/components/ui';
import { useNearbyOpenRequests, useRefetchOnFocus } from '@/hooks';
import { routes } from '@/lib/routes';
import { makeStyles, useTheme } from '@/theme';

import type { NearbyFilterParams } from '../../explore-filters';

interface ExploreListViewProps {
  params: NearbyFilterParams;
  hasFilters: boolean;
  onAdjustFilters: () => void;
  onClearFilters: () => void;
}

export function ExploreListView({ params, hasFilters, onAdjustFilters, onClearFilters }: ExploreListViewProps) {
  const styles = useStyles();
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation(['explore', 'common']);
  const query = useNearbyOpenRequests(params);
  const pull = usePullToRefresh(() => query.refetch());
  useRefetchOnFocus(query.refetch);

  const items = query.data?.items ?? [];

  if (query.data === undefined) {
    return (
      <View style={styles.flex}>
        {query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} retrying={query.isRefetching} />
        ) : (
          <View style={styles.skeletons}>
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
      ListEmptyComponent={
        <EmptyState
          title={hasFilters ? t('explore:empty.filteredTitle') : t('explore:empty.areaTitle')}
          actionLabel={hasFilters ? t('explore:empty.clearFilters') : t('explore:empty.expandArea')}
          onAction={hasFilters ? onClearFilters : () => router.push(routes.editServiceArea)}
          secondaryActionLabel={hasFilters ? t('explore:empty.adjustFilters') : undefined}
          onSecondaryAction={hasFilters ? onAdjustFilters : undefined}
        />
      }
      ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator style={styles.footer} color={theme.colors.primary} /> : null}
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
      }}
      onEndReachedThreshold={0.4}
      refreshControl={
        <RefreshControl
          refreshing={pull.refreshing}
          onRefresh={pull.onRefresh}
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
    paddingTop: t.spacing.xs,
    paddingBottom: t.spacing.xxxl,
    flexGrow: 1,
    width: '100%',
    maxWidth: t.layout.maxContentWidth,
    alignSelf: 'center',
  },
  skeletons: {
    paddingHorizontal: t.spacing.screen,
    paddingTop: t.spacing.xs,
    gap: t.spacing.md,
  },
  separator: {
    height: t.spacing.md,
  },
  footer: {
    paddingVertical: t.spacing.xl,
  },
}));
