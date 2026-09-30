/**
 * Customer Home tab: a greeting, the "Request a service" card with popular services, and one
 * "Active" section with the few things that need the customer right now.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CategoryGrid, CategoryPickerSheet } from '@/components/categories';
import { AppText, Button, Card, Screen, Skeleton } from '@/components/ui';
import { useCurrentUser, useCustomerDashboard, useCustomerRequests, useRefetchOnFocus } from '@/hooks';
import { routes } from '@/lib/routes';
import { makeStyles } from '@/theme';
import type { CategoryId } from '@/types/domain';
import { isolateText } from '@/utils/bidi';

import { ActiveSection } from '../components/home/active-section';
import { buildHomeActiveRows, REQUEST_TAB_STATUSES, type HomeActiveRow } from '../customer-home-model';

/** Popular services under the request card (a "More" tile opens every service). */
const POPULAR_LIMIT = 7;

export default function CustomerHomeScreen() {
  const styles = useStyles();
  const router = useRouter();
  const { t } = useTranslation('customer');
  const userQuery = useCurrentUser();
  const dashboardQuery = useCustomerDashboard();
  // Same query as the Requests tab's "Active" segment (shared cache).
  const activeQuery = useCustomerRequests({ statuses: [...REQUEST_TAB_STATUSES.active] });
  const [pickerOpen, setPickerOpen] = useState(false);
  useRefetchOnFocus(dashboardQuery.refetch);
  useRefetchOnFocus(activeQuery.refetch);

  const firstName = userQuery.data?.user.firstName;
  const dashboard = dashboardQuery.data;
  const activeRequests = activeQuery.data?.items;
  const rows =
    dashboard && activeRequests
      ? buildHomeActiveRows({ requests: activeRequests, upcomingJobs: dashboard.upcomingJobs, jobsAwaitingReview: dashboard.jobsAwaitingReview })
      : undefined;
  const error = dashboardQuery.error ?? activeQuery.error;

  const startRequest = (categoryId?: CategoryId) => router.push(routes.newRequest(categoryId ? { categoryId } : {}));

  const openRow = (row: HomeActiveRow) => {
    if (row.kind === 'review') router.push(routes.reviewJob(row.job.id));
    else router.push(routes.request(row.request.id));
  };

  const refresh = () => Promise.all([dashboardQuery.refetch(), activeQuery.refetch()]);

  return (
    <Screen
      gap="xxxl"
      onRefresh={refresh}
      testID="customer-home"
    >
      <View style={styles.greeting}>
        {firstName !== undefined ? (
          <AppText variant="largeTitle" accessibilityRole="header" numberOfLines={1}>
            {t('home.hello', { name: isolateText(firstName) })}
          </AppText>
        ) : userQuery.isError ? (
          // Not a skeleton that never resolves: the "Active" section below says what failed.
          <AppText variant="largeTitle" accessibilityRole="header" numberOfLines={1} testID="home-greeting-neutral">
            {t('home.helloNeutral')}
          </AppText>
        ) : (
          <Skeleton width="45%" height={30} style={styles.greetingSkeleton} />
        )}
      </View>

      <View style={styles.requestBlock}>
        <Card padding="xl" style={styles.requestCard}>
          <View style={styles.requestTexts}>
            <AppText variant="heading" accessibilityRole="header">
              {t('home.request.title')}
            </AppText>
            <AppText variant="body" color="secondary">
              {t('home.request.subtitle')}
            </AppText>
          </View>
          <Button label={t('home.request.action')} fullWidth onPress={() => startRequest()} testID="home-request-service" />
        </Card>
        <CategoryGrid limit={POPULAR_LIMIT} onSelect={startRequest} onShowAll={() => setPickerOpen(true)} />
      </View>

      <ActiveSection
        rows={rows}
        onOpenRow={openRow}
        error={rows === undefined ? error : null}
        onRetry={() => void refresh()}
        retrying={dashboardQuery.isRefetching || activeQuery.isRefetching}
      />

      <CategoryPickerSheet mode="single" visible={pickerOpen} value={null} onClose={() => setPickerOpen(false)} onChange={startRequest} />
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  greeting: {
    paddingTop: t.spacing.sm,
    minHeight: t.typography.largeTitle.lineHeight + t.spacing.sm,
  },
  greetingSkeleton: {
    marginTop: t.spacing.xs,
  },
  requestBlock: {
    gap: t.spacing.xxl,
  },
  requestCard: {
    gap: t.spacing.lg,
  },
  requestTexts: {
    gap: t.spacing.xs,
  },
}));
