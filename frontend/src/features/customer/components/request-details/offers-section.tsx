import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  ErrorState,
  SectionHeader,
  SegmentedControl,
  SkeletonCard,
  useConfirm,
  useErrorToast,
  useNow,
  useToast,
  type SegmentedOption,
} from '@/components/ui';
import { canCustomerAcceptOffer } from '@/features/offers/offer-status-machine';
import { sortOffers } from '@/features/offers/offer-sorting';
import { useAcceptOffer, useRefetchOnFocus, useRequestOffers } from '@/hooks';
import { useFormatters } from '@/i18n/hooks';
import { routes } from '@/lib/routes';
import { makeStyles } from '@/theme';
import type { OfferSort } from '@/types/api';
import type { CustomerRequestView, OfferWithProfessional } from '@/types/domain';
import { isolateText } from '@/utils/bidi';

import { markOffersSeen } from '../../seen-offers-store';
import { OfferCard } from './offer-card';

/** The three sort orders the customer can pick (applied locally with the shared `sortOffers`). */
const SORTS = ['recommended', 'lowest_price', 'earliest_availability'] as const satisfies readonly OfferSort[];
type CustomerOfferSort = (typeof SORTS)[number];

interface OffersSectionProps {
  request: CustomerRequestView;
  /** Incremented by the screen's pull-to-refresh. */
  refreshSignal?: number;
}

/**
 * Pending offers of a request that still accepts offers: a small sort control and simple offer
 * cards with an explicit, confirmed "Accept". Hidden until the first offer arrives (the status
 * line above says the request is waiting).
 */
export function OffersSection({ request, refreshSignal = 0 }: OffersSectionProps) {
  const styles = useStyles();
  const router = useRouter();
  const { t } = useTranslation(['customer', 'common']);
  const format = useFormatters();
  const confirm = useConfirm();
  const toast = useToast();
  const showError = useErrorToast();
  const now = useNow(60_000);
  const [sort, setSort] = useState<CustomerOfferSort>('recommended');
  const offersQuery = useRequestOffers(request.id, { statuses: ['pending'] });
  const accept = useAcceptOffer();
  const offers = sortOffers(offersQuery.data ?? [], sort);
  const acceptingOfferId = accept.isPending ? (accept.variables ?? null) : null;
  const loaded = offersQuery.data !== undefined;
  const { refetch } = offersQuery;
  useRefetchOnFocus(refetch);

  useEffect(() => {
    if (refreshSignal > 0) void refetch();
  }, [refreshSignal, refetch]);

  // Opening the offers counts as having seen them (clears the "new offers" dot in lists).
  useEffect(() => {
    if (loaded) markOffersSeen(request.id, request.latestOfferAt);
  }, [loaded, request.id, request.latestOfferAt]);

  const handleAccept = async (offer: OfferWithProfessional) => {
    if (accept.isPending) return;
    const name = isolateText(offer.professional.displayName);
    const others = offers.length - 1;
    const confirmed = await confirm({
      title: t('customer:offers.acceptConfirm.title', { name }),
      message: [
        t('customer:offers.acceptConfirm.summary', {
          price: format.currency(offer.price, offer.currency),
          date: format.dateTime(offer.proposedStartAt, { now }),
        }),
        others > 0 ? t('customer:offers.acceptConfirm.othersDeclined', { count: others }) : null,
      ]
        .filter(Boolean)
        .join('\n\n'),
      confirmLabel: t('customer:offers.acceptConfirm.confirm'),
    });
    if (!confirmed) return;
    accept.mutate(offer.id, {
      onSuccess: ({ job }) =>
        toast.show({
          title: t('customer:offers.acceptedToast.title', { name }),
          message: t('customer:offers.acceptedToast.message'),
          tone: 'success',
          onPress: () => router.push(routes.job(job.id)),
        }),
      onError: (error) => {
        showError(error);
        void offersQuery.refetch();
      },
    });
  };

  if (!loaded) {
    if (offersQuery.isError) {
      return <ErrorState compact error={offersQuery.error} onRetry={() => void refetch()} retrying={offersQuery.isRefetching} />;
    }
    return request.pendingOfferCount > 0 ? <SkeletonCard lines={3} /> : null;
  }
  if (offers.length === 0) return null;

  const sortOptions: SegmentedOption<CustomerOfferSort>[] = SORTS.map((value) => ({ value, label: t(`customer:offers.sorts.${value}`) }));

  return (
    <View style={styles.section} testID="offers-section">
      <SectionHeader title={t('customer:offers.title', { count: offers.length })} style={styles.header} />
      {offers.length > 1 ? (
        <SegmentedControl options={sortOptions} value={sort} onChange={setSort} size="sm" testID="offers-sort" />
      ) : null}
      <View style={styles.list}>
        {offers.map((offer) => (
          <OfferCard
            key={offer.id}
            offer={offer}
            now={now}
            canAccept={canCustomerAcceptOffer(offer, request, now)}
            accepting={acceptingOfferId === offer.id}
            disabled={acceptingOfferId !== null && acceptingOfferId !== offer.id}
            onAccept={() => void handleAccept(offer)}
            onOpenProfessional={() => router.push(routes.professionalProfile(offer.professional.id))}
          />
        ))}
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  section: {
    gap: t.spacing.md,
  },
  header: {
    marginBottom: 0,
  },
  list: {
    gap: t.spacing.md,
  },
}));
