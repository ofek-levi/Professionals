/**
 * Professional tab "Jobs": upcoming, active and completed jobs. Appointments awaiting confirmation
 * are highlighted with an inline confirm action; completed jobs show an earnings summary.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { JobCardSkeleton } from '@/components/jobs';
import { EmptyState, ErrorState, Screen, ScreenHeader, SegmentedControl, useNow, type SegmentedOption } from '@/components/ui';
import { useJobs, useRefetchOnFocus } from '@/hooks';
import { routes } from '@/lib/routes';
import { makeStyles } from '@/theme';

import { EarningsSummary } from '../components/jobs/earnings-summary';
import { ProJobItem } from '../components/jobs/pro-job-item';
import { summarizeCompletedJobs } from '../home-model';

type JobsTab = 'upcoming' | 'active' | 'completed';

export default function ProfessionalJobsScreen() {
  const styles = useStyles();
  const router = useRouter();
  const { t } = useTranslation(['professional', 'common']);
  const now = useNow(60_000);
  const [tab, setTab] = useState<JobsTab>('upcoming');
  const upcoming = useJobs('upcoming');
  const active = useJobs('active');
  const completed = useJobs('completed');
  const queries = { upcoming, active, completed };
  const query = queries[tab];
  useRefetchOnFocus(query.refetch);

  const options: SegmentedOption<JobsTab>[] = [
    { value: 'upcoming', label: t('professional:jobs.tabs.upcoming'), count: upcoming.data?.length },
    { value: 'active', label: t('professional:jobs.tabs.active'), count: active.data?.length },
    { value: 'completed', label: t('professional:jobs.tabs.completed') },
  ];

  const jobs = query.data;
  const emptyIcon = tab === 'completed' ? 'check-decagram-outline' : tab === 'active' ? 'progress-wrench' : 'calendar-blank-outline';

  return (
    <Screen
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
      gap="md"
      header={
        <View style={styles.header}>
          <ScreenHeader title={t('professional:jobs.title')} subtitle={t('professional:jobs.subtitle')} />
          <SegmentedControl options={options} value={tab} onChange={setTab} testID="pro-jobs-tabs" />
        </View>
      }
      testID="pro-jobs-screen"
    >
      {jobs === undefined ? (
        query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} retrying={query.isRefetching} />
        ) : (
          <>
            <JobCardSkeleton />
            <JobCardSkeleton />
          </>
        )
      ) : (
        <>
          {tab === 'completed' && jobs.length > 0 ? <EarningsSummary summary={summarizeCompletedJobs(jobs, now)} /> : null}
          {jobs.length === 0 ? (
            <EmptyState
              icon={emptyIcon}
              title={t(`professional:jobs.empty.${tab}.title`)}
              description={t(`professional:jobs.empty.${tab}.description`)}
              actionLabel={tab === 'completed' ? undefined : t('professional:jobs.empty.browse')}
              actionIcon="map-search-outline"
              onAction={tab === 'completed' ? undefined : () => router.push(routes.professional.explore)}
            />
          ) : (
            jobs.map((job) => <ProJobItem key={job.id} job={job} onPress={() => router.push(routes.job(job.id))} />)
          )}
        </>
      )}
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  header: {
    paddingBottom: t.spacing.sm,
  },
}));
