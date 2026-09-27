/**
 * Customer home tab: greeting, "Request a service" hero, things that need attention (offers
 * waiting, reviews), upcoming jobs, service discovery and recent requests.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CategoryGrid, CategoryPickerSheet } from '@/components/categories';
import { JobCard, JobCardSkeleton } from '@/components/jobs';
import { RequestCard, RequestCardSkeleton } from '@/components/requests';
import { ErrorState, Screen, SectionHeader } from '@/components/ui';
import { useCustomerDashboard, useRefetchOnFocus, useUnreadNotificationsCount } from '@/hooks';
import { routes } from '@/lib/routes';
import { makeStyles } from '@/theme';
import type { CustomerRequestSection } from '@/constants/request-statuses';
import type { CategoryId } from '@/types/domain';

import { BrowseByType } from '../components/home/browse-by-type';
import { OffersAttentionCard, ReviewPromptCard, SummaryTiles, SummaryTilesSkeleton } from '../components/home/home-cards';
import { HomeHeader } from '../components/home/home-header';
import { RequestHeroCard } from '../components/home/request-hero-card';
import { HowItWorks } from '../components/how-it-works';
import { getOffersAttentionTarget, hasCustomerActivity } from '../customer-home-model';
import { hasUnseenOffers, useSeenOffers } from '../seen-offers-store';

const POPULAR_LIMIT = 7;

export default function CustomerHomeScreen() {
  const styles = useStyles();
  const router = useRouter();
  const { t } = useTranslation(['customer', 'common']);
  const dashboardQuery = useCustomerDashboard();
  const unreadQuery = useUnreadNotificationsCount();
  const seenOffers = useSeenOffers();
  const [pickerOpen, setPickerOpen] = useState(false);
  useRefetchOnFocus(dashboardQuery.refetch);

  const dashboard = dashboardQuery.data;
  const startRequest = (categoryId?: CategoryId) => router.push(routes.newRequest(categoryId ? { categoryId } : {}));
  const openSection = (section: CustomerRequestSection | null) => router.navigate(routes.customerRequests(section));

  const refresh = () => {
    void dashboardQuery.refetch();
    void unreadQuery.refetch();
  };

  const openAttention = () => {
    if (!dashboard) return;
    const target = getOffersAttentionTarget(dashboard);
    if (target.kind === 'request') router.push(routes.request(target.requestId));
    else openSection(target.section);
  };

  const isNewCustomer = dashboard ? !hasCustomerActivity(dashboard) : false;

  return (
    <Screen gap="xxl" refreshing={dashboardQuery.isRefetching} onRefresh={refresh} testID="customer-home">
      <HomeHeader />

      <RequestHeroCard onSearch={() => setPickerOpen(true)} />

      {dashboard && dashboard.pendingOffersCount > 0 ? (
        <OffersAttentionCard
          pendingOffersCount={dashboard.pendingOffersCount}
          requestsWithOffersCount={dashboard.requestsWithOffersCount}
          onPress={openAttention}
        />
      ) : null}

      {dashboard ? (
        isNewCustomer ? null : (
          <SummaryTiles dashboard={dashboard} onOpenSection={openSection} />
        )
      ) : dashboardQuery.isError ? (
        <ErrorState compact error={dashboardQuery.error} onRetry={refresh} retrying={dashboardQuery.isRefetching} />
      ) : (
        <SummaryTilesSkeleton />
      )}

      {dashboard && dashboard.jobsAwaitingReview.length > 0 ? (
        <View>
          <SectionHeader title={t('customer:home.sections.rateYourPro')} icon="star-outline" />
          <View style={styles.list}>
            {dashboard.jobsAwaitingReview.slice(0, 2).map((job) => (
              <ReviewPromptCard key={job.id} job={job} onPress={() => router.push(routes.reviewJob(job.id))} />
            ))}
          </View>
        </View>
      ) : null}

      {dashboard ? (
        dashboard.upcomingJobs.length > 0 ? (
          <View>
            <SectionHeader
              title={t('customer:home.sections.upcomingJobs')}
              icon="calendar-check-outline"
              actionLabel={t('common:actions.seeAll')}
              onAction={() => openSection('active')}
            />
            <View style={styles.list}>
              {dashboard.upcomingJobs.map((job) => (
                <JobCard key={job.id} job={job} viewerRole="customer" onPress={() => router.push(routes.job(job.id))} />
              ))}
            </View>
          </View>
        ) : null
      ) : dashboardQuery.isPending ? (
        <View>
          <SectionHeader title={t('customer:home.sections.upcomingJobs')} icon="calendar-check-outline" />
          <JobCardSkeleton />
        </View>
      ) : null}

      <View>
        <SectionHeader
          title={t('customer:home.sections.popular')}
          subtitle={t('customer:home.sections.popularSubtitle')}
        />
        <CategoryGrid limit={POPULAR_LIMIT} onSelect={startRequest} onShowAll={() => setPickerOpen(true)} />
      </View>

      <View>
        <SectionHeader title={t('customer:home.sections.browse')} subtitle={t('customer:home.sections.browseSubtitle')} />
        <BrowseByType onSelectCategory={startRequest} />
      </View>

      {isNewCustomer ? (
        <HowItWorks onStart={() => setPickerOpen(true)} />
      ) : dashboard && dashboard.recentRequests.length > 0 ? (
        <View>
          <SectionHeader
            title={t('customer:home.sections.recentRequests')}
            icon="clipboard-text-outline"
            actionLabel={t('common:actions.seeAll')}
            onAction={() => openSection(null)}
          />
          <View style={styles.list}>
            {dashboard.recentRequests.map((request) => (
              <RequestCard
                key={request.id}
                variant="customer"
                request={request}
                hasNewOffers={hasUnseenOffers(request, seenOffers)}
                onPress={() => router.push(routes.request(request.id))}
                testID={`home-request-${request.id}`}
              />
            ))}
          </View>
        </View>
      ) : dashboardQuery.isPending ? (
        <View style={styles.list}>
          <RequestCardSkeleton />
          <RequestCardSkeleton />
        </View>
      ) : null}

      <CategoryPickerSheet
        mode="single"
        visible={pickerOpen}
        value={null}
        onClose={() => setPickerOpen(false)}
        onChange={(id) => startRequest(id)}
      />
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  list: {
    gap: t.spacing.md,
  },
}));
