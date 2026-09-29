/**
 * Professional tab "Home": greeting and business name, how many open jobs are nearby (→ Explore), two small counters
 * (→ Work tab) and at most two "Up next" jobs.
 */
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { JobCard } from '@/components/jobs';
import { AppText, Button, Card, ErrorState, Screen, SectionHeader, Skeleton, StatTile } from '@/components/ui';
import { useOwnProfessionalProfile, useProfessionalDashboard, useRefetchOnFocus } from '@/hooks';
import { useFormatters } from '@/i18n/hooks';
import { routes } from '@/lib/routes';
import { makeStyles } from '@/theme';
import { isolateText } from '@/utils/bidi';

import { upNextJobs } from '../home-model';

export default function ProfessionalHomeScreen() {
  const styles = useStyles();
  const router = useRouter();
  const { t } = useTranslation(['professional', 'common']);
  const format = useFormatters();
  const dashboardQuery = useProfessionalDashboard();
  const profileQuery = useOwnProfessionalProfile();
  useRefetchOnFocus(dashboardQuery.refetch);

  const dashboard = dashboardQuery.data;
  const profile = profileQuery.data;
  const firstName = profile?.fullName.split(/\s+/)[0] ?? '';
  const upNext = upNextJobs(dashboard?.upcomingAppointments ?? []);

  const refresh = () => {
    void dashboardQuery.refetch();
    void profileQuery.refetch();
  };

  return (
    <Screen
      refreshing={dashboardQuery.isRefetching || profileQuery.isRefetching}
      onRefresh={refresh}
      contentContainerStyle={styles.content}
      testID="pro-home-screen"
    >
      {/* Same greeting as the customer's Home ("Hi, Noa"), with the business name as the one extra line. */}
      <View style={styles.greeting}>
        {profile ? (
          <>
            <AppText variant="largeTitle" accessibilityRole="header" numberOfLines={1}>
              {t('professional:home.hello', { name: isolateText(firstName) })}
            </AppText>
            <AppText variant="body" color="secondary" numberOfLines={1}>
              {profile.displayName}
            </AppText>
          </>
        ) : (
          <>
            <Skeleton width="45%" height={30} style={styles.greetingSkeleton} />
            <Skeleton width="55%" height={14} />
          </>
        )}
      </View>

      {dashboard === undefined ? (
        dashboardQuery.isError ? (
          <ErrorState error={dashboardQuery.error} onRetry={() => void dashboardQuery.refetch()} retrying={dashboardQuery.isRefetching} />
        ) : (
          <View style={styles.section}>
            <Skeleton height={164} radius={16} />
            <View style={styles.tiles}>
              <Skeleton height={76} radius={16} style={styles.flex} />
              <Skeleton height={76} radius={16} style={styles.flex} />
            </View>
          </View>
        )
      ) : (
        <>
          <View style={styles.section}>
            <Card padding="xl" style={styles.hero} testID="pro-home-open-jobs">
              <View style={styles.heroTexts}>
                <AppText variant="title" numberOfLines={2}>
                  {dashboard.nearbyOpenRequestsCount > 0
                    ? t('professional:home.openJobs', { count: dashboard.nearbyOpenRequestsCount })
                    : t('professional:home.noOpenJobs')}
                </AppText>
                {profile ? (
                  <AppText variant="caption" color="secondary" numberOfLines={1}>
                    {t('professional:home.serviceArea', {
                      area: profile.serviceArea.label,
                      distance: format.distance(profile.serviceArea.radiusKm),
                    })}
                  </AppText>
                ) : null}
              </View>
              <Button
                label={t('professional:home.findJobs')}
                onPress={() => router.navigate(routes.professional.explore)}
                fullWidth
                testID="pro-home-find-jobs"
              />
            </Card>

            <View style={styles.tiles}>
              <StatTile
                label={t('professional:home.pendingOffers')}
                value={format.number(dashboard.pendingOffersCount)}
                onPress={() => router.navigate(routes.professional.work('offers'))}
                testID="pro-home-stat-offers"
              />
              <StatTile
                label={t('professional:home.activeJobs')}
                value={format.number(dashboard.activeJobsCount)}
                onPress={() => router.navigate(routes.professional.work('jobs'))}
                testID="pro-home-stat-jobs"
              />
            </View>
          </View>

          <View style={styles.section} testID="pro-home-up-next">
            <SectionHeader title={t('professional:home.upNext')} style={styles.sectionHeader} />
            {upNext.length === 0 ? (
              <AppText variant="body" color="muted">
                {t('professional:home.upNextEmpty')}
              </AppText>
            ) : (
              upNext.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  viewerRole="professional"
                  onPress={() => router.push(routes.job(job.id))}
                  testID={`pro-home-job-${job.id}`}
                />
              ))
            )}
          </View>
        </>
      )}
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  content: {
    gap: t.layout.sectionGap,
  },
  greeting: {
    gap: t.spacing.xxs,
    paddingTop: t.spacing.sm,
    minHeight: t.typography.largeTitle.lineHeight + t.typography.body.lineHeight + t.spacing.sm,
  },
  greetingSkeleton: {
    marginTop: t.spacing.xs,
  },
  sectionHeader: {
    marginBottom: 0,
  },
  section: {
    gap: t.spacing.md,
  },
  hero: {
    gap: t.spacing.xl,
  },
  heroTexts: {
    gap: t.spacing.xs,
  },
  tiles: {
    flexDirection: 'row',
    gap: t.spacing.md,
  },
  flex: {
    flex: 1,
  },
}));
