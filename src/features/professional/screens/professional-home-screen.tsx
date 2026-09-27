/**
 * Professional tab "Home": greeting and availability, performance, what needs attention, new jobs
 * nearby, upcoming appointments, pending offers, recent notifications and shortcuts.
 */
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { JobCard, JobCardSkeleton } from '@/components/jobs';
import { RequestCard, RequestCardSkeleton } from '@/components/requests';
import { Button, Card, EmptyState, ErrorState, Screen, SectionHeader, useNow } from '@/components/ui';
import { getExpiryCountdown } from '@/features/offers/components/offer-display';
import {
  useJobs,
  useOwnProfessionalProfile,
  useProfessionalDashboard,
  useRefetchOnFocus,
  useUnreadNotificationsCount,
} from '@/hooks';
import { routes } from '@/lib/routes';
import { makeStyles } from '@/theme';

import { AttentionSection } from '../components/home/attention-section';
import { HomeHeader } from '../components/home/home-header';
import { PendingOffersSection } from '../components/home/pending-offers-section';
import { PerformanceCard, PerformanceCardSkeleton } from '../components/home/performance-card';
import { QuickActions } from '../components/home/quick-actions';
import { RecentNotifications } from '../components/home/recent-notifications';
import { jobsAwaitingConfirmation } from '../home-model';

const NEW_JOBS_ON_HOME = 3;
const UPCOMING_ON_HOME = 3;

export default function ProfessionalHomeScreen() {
  const styles = useStyles();
  const router = useRouter();
  const { t } = useTranslation(['professional', 'common']);
  const now = useNow(60_000);
  const dashboardQuery = useProfessionalDashboard();
  const profileQuery = useOwnProfessionalProfile();
  const activeJobsQuery = useJobs('active');
  const unread = useUnreadNotificationsCount().data ?? 0;
  useRefetchOnFocus(dashboardQuery.refetch);
  useRefetchOnFocus(activeJobsQuery.refetch);

  const dashboard = dashboardQuery.data;
  const profile = profileQuery.data;
  const awaitingJobs = jobsAwaitingConfirmation(activeJobsQuery.data ?? []);
  const awaitingIds = new Set(awaitingJobs.map((job) => job.id));
  const expiringOffers = (dashboard?.pendingOffers ?? []).filter((offer) => {
    const countdown = getExpiryCountdown(offer.expiresAt, now);
    return countdown.state === 'active' && countdown.level !== 'normal';
  });
  const upcoming = (dashboard?.upcomingAppointments ?? []).filter((job) => !awaitingIds.has(job.id)).slice(0, UPCOMING_ON_HOME);

  const refreshing = dashboardQuery.isRefetching || profileQuery.isRefetching || activeJobsQuery.isRefetching;
  const refresh = () => {
    void dashboardQuery.refetch();
    void profileQuery.refetch();
    void activeJobsQuery.refetch();
  };

  return (
    <Screen refreshing={refreshing} onRefresh={refresh} gap="xxl" testID="pro-home-screen">
      <HomeHeader
        profile={profile}
        unreadCount={unread}
        now={now}
        onOpenNotifications={() => router.push(routes.professional.notifications)}
        onEditArea={() => router.push(routes.editProfile)}
      />

      {dashboard === undefined ? (
        dashboardQuery.isError ? (
          <ErrorState error={dashboardQuery.error} onRetry={() => void dashboardQuery.refetch()} retrying={dashboardQuery.isRefetching} />
        ) : (
          <View style={styles.section}>
            <PerformanceCardSkeleton />
            <RequestCardSkeleton />
            <JobCardSkeleton />
          </View>
        )
      ) : (
        <>
          <PerformanceCard
            dashboard={dashboard}
            stats={profile?.stats}
            onOpenExplore={() => router.push(routes.professional.explore)}
            onOpenOffers={() => router.push(routes.professional.offers)}
            onOpenJobs={() => router.push(routes.professional.jobs)}
          />

          <AttentionSection awaitingJobs={awaitingJobs} expiringOffers={expiringOffers} />

          <View testID="pro-home-new-jobs">
            <SectionHeader
              title={t('professional:home.newJobs.title')}
              icon="map-marker-radius-outline"
              subtitle={t('professional:home.newJobs.subtitle', { count: dashboard.nearbyOpenRequestsCount })}
              actionLabel={t('professional:home.seeAll')}
              onAction={() => router.push(routes.professional.explore)}
            />
            {dashboard.newRequests.length === 0 ? (
              <Card variant="outlined" padding="none">
                <EmptyState
                  compact
                  icon="map-search-outline"
                  title={t('professional:home.newJobs.emptyTitle')}
                  description={t('professional:home.newJobs.emptyDescription')}
                  actionLabel={t('professional:home.newJobs.expandArea')}
                  onAction={() => router.push(routes.editProfile)}
                />
              </Card>
            ) : (
              <View style={styles.list}>
                {dashboard.newRequests.slice(0, NEW_JOBS_ON_HOME).map((request) => (
                  <RequestCard
                    key={request.id}
                    variant="professional"
                    request={request}
                    onPress={() => router.push(routes.request(request.id))}
                  />
                ))}
              </View>
            )}
            <Button
              label={t('professional:home.newJobs.openMap')}
              variant="secondary"
              leftIcon="map-outline"
              onPress={() => router.push(routes.professional.explore)}
              fullWidth
              style={styles.cta}
              testID="pro-home-open-map"
            />
          </View>

          <View testID="pro-home-upcoming">
            <SectionHeader
              title={t('professional:home.upcoming.title')}
              icon="calendar-clock"
              actionLabel={t('professional:home.seeAll')}
              onAction={() => router.push(routes.professional.jobs)}
            />
            {upcoming.length === 0 ? (
              <Card variant="outlined" padding="none">
                <EmptyState
                  compact
                  icon="calendar-blank-outline"
                  title={t('professional:home.upcoming.emptyTitle')}
                  description={t('professional:home.upcoming.emptyDescription')}
                />
              </Card>
            ) : (
              <View style={styles.list}>
                {upcoming.map((job) => (
                  <JobCard key={job.id} job={job} viewerRole="professional" onPress={() => router.push(routes.job(job.id))} />
                ))}
              </View>
            )}
          </View>

          <PendingOffersSection offers={dashboard.pendingOffers} totalCount={dashboard.pendingOffersCount} />

          <RecentNotifications notifications={dashboard.recentNotifications} />

          <QuickActions />
        </>
      )}
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  section: {
    gap: t.spacing.lg,
  },
  list: {
    gap: t.spacing.md,
  },
  cta: {
    marginTop: t.spacing.md,
  },
}));
