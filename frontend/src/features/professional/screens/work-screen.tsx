/**
 * Professional tab "Work": my offers and my jobs, one segment each, selected by `?tab=offers|jobs`.
 * - Offers: "Waiting for reply" (pending), then "Past": offers that did not turn into a job
 *   (rejected, withdrawn, expired, or accepted and then cancelled). Won offers live under Jobs.
 *   Tap → the request, where the offer can be edited or withdrawn.
 * - Jobs: "Upcoming" (awaiting confirmation, scheduled, in progress), then "Completed" with this
 *   month's earnings (`ProfessionalDashboard.earningsThisMonth`, over every job completed this
 *   month, not only the loaded pages). Tap → the job. Both lists load more on demand.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { JobCard, JobCardSkeleton } from '@/components/jobs';
import { RequestCardSkeleton } from '@/components/requests';
import {
  AppText,
  Button,
  ErrorState,
  Screen,
  ScreenHeader,
  SectionHeader,
  SegmentedControl,
  usePullToRefresh,
  type SegmentedOption,
} from '@/components/ui';
import type { OfferStatus } from '@/constants/offer-statuses';
import { getProfessionalOfferOutcome } from '@/features/offers/offer-status-machine';
import { useJobs, useProfessionalDashboard, useProfessionalOffers, useRefetchOnFocus } from '@/hooks';
import { useFormatters } from '@/i18n/hooks';
import { parseWorkTab, routes, TAB_PARAM, type WorkTab } from '@/lib/routes';
import { makeStyles, useTheme } from '@/theme';

import { WorkOfferCard } from '../components/work/work-offer-card';

// `accepted` is fetched only to catch jobs the customer cancelled later; won offers that became a
// job are filtered out below (they are listed under Jobs).
const PAST_OFFER_STATUSES: OfferStatus[] = ['accepted', 'rejected', 'withdrawn', 'expired'];

export default function WorkScreen() {
  const styles = useStyles();
  const router = useRouter();
  const { t } = useTranslation(['professional', 'common']);
  const params = useLocalSearchParams<{ [TAB_PARAM]?: string }>();
  const tab = parseWorkTab(params[TAB_PARAM]);

  const options: SegmentedOption<WorkTab>[] = [
    { value: 'offers', label: t('professional:work.tabs.offers') },
    { value: 'jobs', label: t('professional:work.tabs.jobs') },
  ];

  return (
    <Screen
      header={
        <View style={styles.header}>
          <ScreenHeader title={t('common:tabs.work')} style={styles.title} />
          <SegmentedControl options={options} value={tab} onChange={(next) => router.setParams({ [TAB_PARAM]: next })} testID="work-tabs" />
        </View>
      }
      scroll={false}
      testID="work-screen"
    >
      {tab === 'offers' ? <OffersSegment /> : <JobsSegment />}
    </Screen>
  );
}

function OffersSegment() {
  const styles = useStyles();
  const router = useRouter();
  const { t } = useTranslation('professional');
  const pending = useProfessionalOffers({ statuses: ['pending'] });
  const past = useProfessionalOffers({ statuses: PAST_OFFER_STATUSES });
  useRefetchOnFocus(pending.refetch);
  useRefetchOnFocus(past.refetch);

  const failed = pending.isError && !pending.data ? pending : past.isError && !past.data ? past : null;
  const loading = !pending.data || !past.data;
  const pastItems = (past.data?.items ?? []).filter(
    (offer) => getProfessionalOfferOutcome(offer.status, offer.request.status) !== 'accepted',
  );

  return (
    <Segment
      onRefresh={() => Promise.all([pending.refetch(), past.refetch()])}
      testID="work-offers"
    >
      {failed ? (
        <ErrorState error={failed.error} onRetry={() => void failed.refetch()} retrying={failed.isRefetching} />
      ) : loading ? (
        <ListSkeleton kind="offer" />
      ) : (
        <>
          <View style={styles.section} testID="work-offers-waiting">
            <SectionHeader title={t('work.offers.waiting')} style={styles.sectionHeader} />
            {pending.data.items.length === 0 ? (
              <EmptyLine text={t('work.offers.waitingEmpty')} actionLabel={t('work.offers.findJobs')} onAction={() => router.navigate(routes.professional.explore)} />
            ) : (
              pending.data.items.map((offer) => (
                <WorkOfferCard
                  key={offer.id}
                  offer={offer}
                  showStatus={false}
                  onPress={() => router.push(routes.request(offer.requestId))}
                  testID={`work-offer-${offer.id}`}
                />
              ))
            )}
            <MoreButton visible={pending.hasNextPage} loading={pending.isFetchingNextPage} onPress={() => void pending.fetchNextPage()} />
          </View>

          {pastItems.length > 0 || past.hasNextPage ? (
            <View style={styles.section} testID="work-offers-past">
              <SectionHeader title={t('work.offers.past')} style={styles.sectionHeader} />
              {pastItems.map((offer) => (
                <WorkOfferCard
                  key={offer.id}
                  offer={offer}
                  onPress={() => router.push(routes.request(offer.requestId))}
                  testID={`work-offer-${offer.id}`}
                />
              ))}
              <MoreButton visible={past.hasNextPage} loading={past.isFetchingNextPage} onPress={() => void past.fetchNextPage()} />
            </View>
          ) : null}
        </>
      )}
    </Segment>
  );
}

function JobsSegment() {
  const styles = useStyles();
  const router = useRouter();
  const { t } = useTranslation('professional');
  const format = useFormatters();
  const upcoming = useJobs('active');
  const completed = useJobs('completed');
  const dashboard = useProfessionalDashboard();
  useRefetchOnFocus(upcoming.refetch);
  useRefetchOnFocus(completed.refetch);
  useRefetchOnFocus(dashboard.refetch);

  const failed = upcoming.isError && !upcoming.data ? upcoming : completed.isError && !completed.data ? completed : null;
  const completedJobs = completed.data?.items ?? [];
  const earnings = dashboard.data?.earningsThisMonth;
  // Nothing earned yet this month: no "₪0" line, the list speaks for itself.
  const monthTotal = earnings && earnings.amount > 0 ? format.currency(earnings.amount, earnings.currency) : null;

  return (
    <Segment
      onRefresh={() => Promise.all([upcoming.refetch(), completed.refetch(), dashboard.refetch()])}
      testID="work-jobs"
    >
      {failed ? (
        <ErrorState error={failed.error} onRetry={() => void failed.refetch()} retrying={failed.isRefetching} />
      ) : !upcoming.data || !completed.data ? (
        <ListSkeleton kind="job" />
      ) : (
        <>
          <View style={styles.section} testID="work-jobs-upcoming">
            <SectionHeader title={t('work.jobs.upcoming')} style={styles.sectionHeader} />
            {upcoming.data.items.length === 0 ? (
              <EmptyLine text={t('work.jobs.upcomingEmpty')} />
            ) : (
              upcoming.data.items.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  viewerRole="professional"
                  onPress={() => router.push(routes.job(job.id))}
                  testID={`work-job-${job.id}`}
                />
              ))
            )}
            <MoreButton visible={upcoming.hasNextPage} loading={upcoming.isFetchingNextPage} onPress={() => void upcoming.fetchNextPage()} />
          </View>

          {completedJobs.length > 0 ? (
            <View style={styles.section} testID="work-jobs-completed">
              <SectionHeader
                title={t('work.jobs.completed')}
                trailing={
                  monthTotal ? (
                    <AppText variant="caption" color="secondary" tabular numberOfLines={1} testID="work-month-total">
                      {t('work.jobs.thisMonth', { total: monthTotal })}
                    </AppText>
                  ) : undefined
                }
                style={styles.sectionHeader}
              />
              {completedJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  viewerRole="professional"
                  showPrice
                  showStatus={false}
                  onPress={() => router.push(routes.job(job.id))}
                  testID={`work-job-${job.id}`}
                />
              ))}
              <MoreButton visible={completed.hasNextPage} loading={completed.isFetchingNextPage} onPress={() => void completed.fetchNextPage()} />
            </View>
          ) : null}
        </>
      )}
    </Segment>
  );
}

/** Scrollable body of one segment (pull to refresh: the spinner shows for the user's pull only). */
function Segment({ children, onRefresh, testID }: { children: ReactNode; onRefresh: () => Promise<unknown>; testID: string }) {
  const styles = useStyles();
  const theme = useTheme();
  const pull = usePullToRefresh(onRefresh);
  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={pull.refreshing}
          onRefresh={pull.onRefresh}
          tintColor={theme.colors.primary}
          colors={[theme.colors.primary]}
          progressBackgroundColor={theme.colors.surface}
        />
      }
      testID={testID}
    >
      {children}
    </ScrollView>
  );
}

function EmptyLine({ text, actionLabel, onAction }: { text: string; actionLabel?: string; onAction?: () => void }) {
  const styles = useStyles();
  return (
    <View style={styles.empty}>
      <AppText variant="body" color="muted" style={styles.flex}>
        {text}
      </AppText>
      {actionLabel && onAction ? <Button label={actionLabel} variant="ghost" size="sm" onPress={onAction} style={styles.emptyAction} /> : null}
    </View>
  );
}

function MoreButton({ visible, loading, onPress }: { visible: boolean; loading: boolean; onPress: () => void }) {
  const { t } = useTranslation('common');
  if (!visible) return null;
  return <Button label={t('actions.showMore')} variant="ghost" size="sm" loading={loading} onPress={onPress} />;
}

function ListSkeleton({ kind }: { kind: 'offer' | 'job' }) {
  const styles = useStyles();
  const Item = kind === 'job' ? JobCardSkeleton : RequestCardSkeleton;
  return (
    <View style={styles.section}>
      <Item />
      <Item />
      <Item />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  header: {
    paddingBottom: t.spacing.md,
  },
  title: {
    paddingBottom: t.spacing.lg,
  },
  content: {
    gap: t.layout.sectionGap,
    paddingTop: t.spacing.sm,
    paddingBottom: t.spacing.xxxl,
  },
  section: {
    gap: t.spacing.md,
  },
  sectionHeader: {
    marginBottom: 0,
  },
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  emptyAction: {
    marginEnd: -t.spacing.md,
  },
  flex: {
    flex: 1,
  },
}));
