import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  AppText,
  Badge,
  Button,
  Chip,
  EmptyState,
  ErrorState,
  SegmentedControl,
  SkeletonCard,
  useConfirm,
  useErrorToast,
  useNow,
  useToast,
  type IconName,
  type SegmentedOption,
} from '@/components/ui';
import { REQUEST_STATUS_META } from '@/constants/request-statuses';
import { getOfferHighlights } from '@/features/offers/offer-sorting';
import { useAcceptOffer, useRefetchOnFocus, useRequestOffers } from '@/hooks';
import { useFormatters } from '@/i18n/hooks';
import { routes } from '@/lib/routes';
import { makeStyles, useTheme } from '@/theme';
import { OFFER_SORTS, type OfferSort } from '@/types/api';
import type { CustomerRequestView, OfferWithProfessional } from '@/types/domain';
import { isolateText } from '@/utils/bidi';

import { offerStatusesForFilter, type OfferListFilter } from '../../offer-comparison';
import { markOffersSeen } from '../../seen-offers-store';
import { OfferCard, type OfferHighlightKey } from './offer-card';
import { OffersCompareTable } from './offers-compare-table';

const SORT_ICONS: Record<OfferSort, IconName> = {
  recommended: 'thumb-up-outline',
  lowest_price: 'cash',
  earliest_availability: 'clock-fast',
  highest_rating: 'star-outline',
  most_reviews: 'comment-text-multiple-outline',
};

type ViewMode = 'list' | 'compare';

export interface OffersSectionProps {
  request: CustomerRequestView;
  /** Incremented by the screen's pull-to-refresh. */
  refreshSignal?: number;
}

/**
 * The customer's decision space: sortable offers, pending/all filter, side-by-side comparison and
 * an explicit, confirmed acceptance. Nothing is ever selected automatically.
 */
export function OffersSection({ request, refreshSignal = 0 }: OffersSectionProps) {
  const theme = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { t } = useTranslation(['customer', 'common']);
  const format = useFormatters();
  const confirm = useConfirm();
  const toast = useToast();
  const showError = useErrorToast();
  const now = useNow(60_000);
  const acceptsOffers = REQUEST_STATUS_META[request.status].acceptsOffers;
  const [sort, setSort] = useState<OfferSort>('recommended');
  const [filter, setFilter] = useState<OfferListFilter>('pending');
  const [mode, setMode] = useState<ViewMode>('list');
  const statuses = offerStatusesForFilter(filter, acceptsOffers);
  const offersQuery = useRequestOffers(request.id, { sort, statuses });
  const accept = useAcceptOffer();
  const offers = offersQuery.data ?? [];
  const pendingOffers = offers.filter((offer) => offer.status === 'pending');
  const highlights = getOfferHighlights(offers);
  const canCompare = acceptsOffers && pendingOffers.length >= 2;
  const showCompare = mode === 'compare' && canCompare;
  const acceptingOfferId = accept.isPending ? (accept.variables ?? null) : null;
  const loaded = offersQuery.data !== undefined;
  const { refetch } = offersQuery;
  useRefetchOnFocus(refetch);

  useEffect(() => {
    if (refreshSignal > 0) void refetch();
  }, [refreshSignal, refetch]);

  // Opening the offers counts as having seen them (clears the "new offers" highlight).
  useEffect(() => {
    if (loaded) markOffersSeen(request.id, request.latestOfferAt);
  }, [loaded, request.id, request.latestOfferAt]);

  const highlightKeys = (offer: OfferWithProfessional): OfferHighlightKey[] => {
    const keys: OfferHighlightKey[] = [];
    if (highlights.lowestPriceOfferId === offer.id) keys.push('lowestPrice');
    if (highlights.earliestOfferId === offer.id) keys.push('earliest');
    if (highlights.topRatedOfferId === offer.id) keys.push('topRated');
    return keys;
  };

  const openProfessional = (offer: OfferWithProfessional) => router.push(routes.professionalProfile(offer.professional.id));

  const handleAccept = async (offer: OfferWithProfessional) => {
    if (accept.isPending) return;
    const name = isolateText(offer.professional.displayName);
    const confirmed = await confirm({
      title: t('customer:offers.acceptConfirm.title', { name }),
      message: [
        [
          t('customer:offers.acceptConfirm.summary', {
            price: format.currency(offer.price, offer.currency),
            date: format.dateTime(offer.proposedStartAt, { now }),
          }),
          offer.estimatedDurationMinutes
            ? t('customer:offers.duration', { duration: format.duration(offer.estimatedDurationMinutes) })
            : null,
        ]
          .filter(Boolean)
          .join(' · '),
        pendingOffers.length > 1
          ? t('customer:offers.acceptConfirm.othersDeclined', { count: pendingOffers.length - 1 })
          : null,
        t('customer:offers.acceptConfirm.next'),
      ]
        .filter(Boolean)
        .join('\n\n'),
      confirmLabel: t('customer:offers.acceptConfirm.confirm'),
      icon: 'handshake-outline',
      tone: 'success',
    });
    if (!confirmed) return;
    accept.mutate(offer.id, {
      onSuccess: ({ job }) => {
        setMode('list');
        toast.show({
          title: t('customer:offers.acceptedToast.title', { name }),
          message: t('customer:offers.acceptedToast.message'),
          tone: 'success',
          icon: 'check-circle-outline',
          onPress: () => router.push(routes.job(job.id)),
        });
      },
      onError: (error) => {
        showError(error);
        void offersQuery.refetch();
      },
    });
  };

  const filterOptions: SegmentedOption<OfferListFilter>[] = [
    { value: 'pending', label: t('customer:offers.filters.pending'), count: request.pendingOfferCount },
    { value: 'all', label: t('customer:offers.filters.all'), count: request.offerCount },
  ];
  const modeOptions: SegmentedOption<ViewMode>[] = [
    { value: 'list', label: t('customer:offers.modes.list'), icon: 'view-agenda-outline' },
    { value: 'compare', label: t('customer:offers.modes.compare'), icon: 'compare-horizontal' },
  ];

  const subtitle = acceptsOffers
    ? request.pendingOfferCount > 0
      ? t('customer:offers.subtitleDecide')
      : t('customer:offers.subtitleWaiting')
    : undefined;

  let content;
  if (!loaded) {
    content = offersQuery.isError ? (
      <ErrorState compact error={offersQuery.error} onRetry={() => void offersQuery.refetch()} retrying={offersQuery.isRefetching} />
    ) : (
      <View style={styles.list}>
        <SkeletonCard lines={3} />
        <SkeletonCard lines={3} />
      </View>
    );
  } else if (offers.length === 0) {
    content =
      request.offerCount === 0 ? (
        acceptsOffers ? (
          <View style={[styles.waiting, { backgroundColor: theme.colors.tones.info.bg }]}>
            <EmptyState
              compact
              icon="bell-ring-outline"
              tone="info"
              title={t('customer:offers.empty.waitingTitle')}
              description={t('customer:offers.empty.waitingDescription')}
            />
          </View>
        ) : (
          <EmptyState compact icon="tag-off-outline" tone="neutral" title={t('customer:offers.empty.noneTitle')} />
        )
      ) : (
        <EmptyState
          compact
          icon="tag-check-outline"
          title={t('customer:offers.empty.noPendingTitle')}
          description={t('customer:offers.empty.noPendingDescription')}
          actionLabel={t('customer:offers.empty.showAll')}
          onAction={() => setFilter('all')}
        />
      );
  } else if (showCompare) {
    content = (
      <OffersCompareTable
        offers={pendingOffers}
        now={now}
        request={request}
        acceptingOfferId={acceptingOfferId}
        onAccept={(offer) => void handleAccept(offer)}
        onOpenProfessional={openProfessional}
      />
    );
  } else {
    content = (
      <View style={styles.list}>
        {offers.map((offer) => (
          <OfferCard
            key={offer.id}
            offer={offer}
            highlights={highlightKeys(offer)}
            now={now}
            request={request}
            accepting={acceptingOfferId === offer.id}
            disabled={acceptingOfferId !== null && acceptingOfferId !== offer.id}
            onAccept={() => void handleAccept(offer)}
            onOpenProfessional={() => openProfessional(offer)}
          />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.section} testID="offers-section">
      <View style={styles.header}>
        <View style={styles.headerTexts}>
          <View style={styles.titleRow}>
            <AppText variant="title" accessibilityRole="header">
              {t('customer:offers.title')}
            </AppText>
            {request.offerCount > 0 ? <Badge label={String(request.offerCount)} tone="brand" variant="solid" size="sm" /> : null}
            {offersQuery.isFetching && loaded ? <ActivityIndicator size="small" color={theme.colors.primary} /> : null}
          </View>
          {subtitle ? (
            <AppText variant="caption" color="secondary">
              {subtitle}
            </AppText>
          ) : null}
        </View>
      </View>

      {acceptsOffers && request.offerCount > request.pendingOfferCount ? (
        <SegmentedControl options={filterOptions} value={filter} onChange={setFilter} size="sm" testID="offers-filter" />
      ) : null}

      {canCompare ? <SegmentedControl options={modeOptions} value={mode} onChange={setMode} size="sm" testID="offers-mode" /> : null}

      {offers.length > 1 && !showCompare ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sorts} style={styles.sortScroller}>
          {OFFER_SORTS.map((option) => (
            <Chip
              key={option}
              label={t(`customer:offers.sorts.${option}`)}
              icon={SORT_ICONS[option]}
              size="sm"
              selected={sort === option}
              onPress={() => setSort(option)}
              testID={`offers-sort-${option}`}
            />
          ))}
        </ScrollView>
      ) : null}

      {content}

      {acceptsOffers && pendingOffers.length > 0 && !showCompare ? (
        <View style={styles.hint}>
          <Button
            label={t('customer:offers.howToChoose')}
            variant="ghost"
            size="sm"
            leftIcon="information-outline"
            onPress={() =>
              void confirm({
                title: t('customer:offers.howToChooseTitle'),
                message: t('customer:offers.howToChooseMessage'),
                cancelLabel: null,
                confirmLabel: t('common:actions.ok'),
                icon: 'lightbulb-on-outline',
                tone: 'info',
              })
            }
          />
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  section: {
    gap: t.spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.spacing.md,
  },
  headerTexts: {
    flex: 1,
    gap: t.spacing.xxs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  sortScroller: {
    marginHorizontal: -t.spacing.screen,
  },
  sorts: {
    gap: t.spacing.sm,
    paddingHorizontal: t.spacing.screen,
  },
  list: {
    gap: t.spacing.md,
  },
  waiting: {
    borderRadius: t.radii.lg,
  },
  hint: {
    alignItems: 'center',
  },
}));
