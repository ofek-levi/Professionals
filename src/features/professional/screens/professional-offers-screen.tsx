/**
 * Professional tab "My offers": offers by status with counts, expiry countdowns and the actions the
 * offer status machine allows (edit, withdraw, view request, go to job).
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Chip, EmptyState, ErrorState, Screen, ScreenHeader, useNow, type IconSource } from '@/components/ui';
import { OFFER_STATUS_META } from '@/constants/offer-statuses';
import { PRO_OFFER_FILTERS, statusesForOfferFilter, type ProOfferFilter } from '@/features/offers/components/offer-display';
import { ProfessionalOfferCard, ProfessionalOfferCardSkeleton } from '@/features/offers/components/professional-offer-card';
import { useWithdrawOfferFlow } from '@/features/offers/components/use-withdraw-offer-flow';
import { useJobs, useProfessionalOffers, useRefetchOnFocus } from '@/hooks';
import { routes } from '@/lib/routes';
import { makeStyles, useTheme } from '@/theme';

import { useOfferStatusCounts } from '../components/offers/use-offer-status-counts';

const EMPTY_ICONS: Record<ProOfferFilter, IconSource> = {
  pending: 'timer-sand-empty',
  accepted: 'handshake-outline',
  rejected: 'close-circle-outline',
  withdrawn: 'undo-variant',
  expired: 'clock-alert-outline',
  all: 'tag-outline',
};

export default function ProfessionalOffersScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation(['offers', 'common']);
  const now = useNow(30_000);
  const [filter, setFilter] = useState<ProOfferFilter>('pending');
  const query = useProfessionalOffers({ statuses: statusesForOfferFilter(filter) });
  const counts = useOfferStatusCounts();
  const jobsQuery = useJobs('all');
  const { withdraw, pendingOfferId } = useWithdrawOfferFlow();
  useRefetchOnFocus(query.refetch);
  useRefetchOnFocus(counts.refetch);

  const jobIdByOffer = new Map((jobsQuery.data ?? []).map((job) => [job.offerId, job.id]));
  const items = query.data?.items ?? [];

  const refresh = () => {
    void query.refetch();
    counts.refetch();
    void jobsQuery.refetch();
  };

  const header = (
    <View>
      <ScreenHeader title={t('offers:list.title')} subtitle={t('offers:list.subtitle')} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={styles.chipsScroll}
        accessibilityRole="tablist"
      >
        {PRO_OFFER_FILTERS.map((option) => (
          <Chip
            key={option}
            label={t(`offers:filters.${option}`)}
            icon={option === 'all' ? 'format-list-bulleted' : OFFER_STATUS_META[option].icon}
            selected={filter === option}
            count={counts.counts[option]}
            onPress={() => setFilter(option)}
            testID={`offers-filter-${option}`}
          />
        ))}
      </ScrollView>
    </View>
  );

  let body;
  if (query.data === undefined) {
    body = query.isError ? (
      <ErrorState error={query.error} onRetry={() => void query.refetch()} retrying={query.isRefetching} />
    ) : (
      <View style={styles.skeletons}>
        {[0, 1, 2].map((index) => (
          <ProfessionalOfferCardSkeleton key={index} />
        ))}
      </View>
    );
  } else {
    body = (
      <FlatList
        style={styles.flex}
        contentContainerStyle={styles.content}
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ProfessionalOfferCard
            offer={item}
            now={now}
            jobId={jobIdByOffer.get(item.id) ?? null}
            withdrawing={pendingOfferId === item.id}
            onOpen={() => router.push(routes.offer(item.id))}
            onEdit={() => router.push(routes.submitOffer(item.requestId, item.id))}
            onWithdraw={() => void withdraw(item.id)}
            onViewRequest={() => router.push(routes.request(item.requestId))}
            onOpenJob={(jobId) => router.push(routes.job(jobId))}
            testID={`pro-offer-${item.id}`}
          />
        )}
        ItemSeparatorComponent={Separator}
        ListEmptyComponent={
          <EmptyState
            icon={EMPTY_ICONS[filter]}
            title={t(`offers:empty.${filter}.title`)}
            description={t(`offers:empty.${filter}.description`)}
            actionLabel={filter === 'pending' || filter === 'all' ? t('offers:empty.browseJobs') : undefined}
            actionIcon="map-search-outline"
            onAction={filter === 'pending' || filter === 'all' ? () => router.push(routes.professional.explore) : undefined}
          />
        }
        ListFooterComponent={
          query.isFetchingNextPage ? <ActivityIndicator style={styles.footer} color={theme.colors.primary} /> : null
        }
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
        }}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching && !query.isFetchingNextPage}
            onRefresh={refresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
        testID="pro-offers-list"
      />
    );
  }

  return (
    <Screen scroll={false} padded={false} header={<View style={styles.header}>{header}</View>} testID="pro-offers-screen">
      {body}
    </Screen>
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
  header: {
    paddingHorizontal: t.spacing.screen,
  },
  chipsScroll: {
    marginHorizontal: -t.spacing.screen,
    flexGrow: 0,
  },
  chips: {
    gap: t.spacing.sm,
    paddingHorizontal: t.spacing.screen,
    paddingBottom: t.spacing.md,
  },
  content: {
    paddingHorizontal: t.spacing.screen,
    paddingTop: t.spacing.xs,
    paddingBottom: t.spacing.xxxl,
    flexGrow: 1,
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
