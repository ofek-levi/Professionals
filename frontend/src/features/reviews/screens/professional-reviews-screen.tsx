/**
 * `/professionals/:professionalId/reviews` – rating summary (average + distribution) and the
 * infinite list of the professional's reviews, newest first.
 */
import { Stack } from 'expo-router';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RatingSummary, ReviewCard } from '@/components/professionals';
import { Card, EmptyState, ErrorState, Screen, Skeleton, SkeletonCard, usePullToRefresh } from '@/components/ui';
import { useProfessionalProfile, useProfessionalReviews, useRefetchOnFocus, useRouteParam } from '@/hooks';
import { makeStyles, useTheme } from '@/theme';
import { isolateText } from '@/utils/bidi';

export default function ProfessionalReviewsScreen() {
  const theme = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation(['reviews', 'common']);
  const professionalId = useRouteParam('professionalId');
  const query = useProfessionalReviews(professionalId);
  const profileQuery = useProfessionalProfile(professionalId);
  const pull = usePullToRefresh(() => Promise.all([query.refetch(), profileQuery.refetch()]));
  useRefetchOnFocus(query.refetch);

  const professional = profileQuery.data;
  const title = professional ? t('reviews:list.title', { name: isolateText(professional.displayName) }) : t('common:screens.professionalReviews');

  if (!professionalId || query.data === undefined) {
    return (
      <Screen edges={['left', 'right', 'bottom']} gap="md" testID="reviews-loading">
        <Stack.Screen options={{ title }} />
        {!professionalId ? (
          <EmptyState icon="account-search-outline" title={t('common:states.notFoundTitle')} description={t('common:states.notFoundDescription')} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} retrying={query.isRefetching} />
        ) : (
          <>
            <Card padding="lg" style={styles.summarySkeleton}>
              <View style={styles.skeletonScore}>
                <Skeleton width={64} height={36} />
                <Skeleton width={90} height={14} />
              </View>
              <View style={styles.skeletonBars}>
                {[0, 1, 2, 3, 4].map((index) => (
                  <Skeleton key={index} height={8} radius={999} />
                ))}
              </View>
            </Card>
            <SkeletonCard lines={2} />
            <SkeletonCard lines={3} />
          </>
        )}
      </Screen>
    );
  }

  const data = query.data;
  const breakdown = data.breakdown ?? { averageRating: null, reviewCount: data.totalCount, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };

  const header = (
    <Card padding="lg" style={styles.header}>
      <RatingSummary breakdown={breakdown} />
    </Card>
  );

  return (
    <Screen edges={['left', 'right']} scroll={false} padded={false} testID="reviews-screen">
      <Stack.Screen options={{ title }} />
      <FlatList
        data={data.items}
        keyExtractor={(review) => review.id}
        renderItem={({ item }) => <ReviewCard review={item} showCategory />}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <EmptyState
            icon="star-outline"
            tone="warning"
            title={t('reviews:list.emptyTitle')}
            description={t('reviews:list.emptyDescription')}
            compact
          />
        }
        ListFooterComponent={
          query.isFetchingNextPage ? <ActivityIndicator color={theme.colors.primary} style={styles.spinner} /> : null
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
        }}
        refreshControl={
          <RefreshControl
            refreshing={pull.refreshing}
            onRefresh={pull.onRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
        contentContainerStyle={[styles.listContent, { paddingBottom: theme.spacing.xxxl + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        testID="reviews-list"
      />
    </Screen>
  );
}

function Separator() {
  const styles = useStyles();
  return <View style={styles.separator} />;
}

const useStyles = makeStyles((t) => ({
  listContent: {
    width: '100%',
    maxWidth: t.layout.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: t.spacing.screen,
    paddingTop: t.spacing.md,
  },
  header: {
    marginBottom: t.spacing.xl,
  },
  separator: {
    height: t.spacing.md,
  },
  spinner: {
    marginVertical: t.spacing.lg,
  },
  summarySkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xl,
  },
  skeletonScore: {
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  skeletonBars: {
    flex: 1,
    gap: t.spacing.sm,
  },
}));
