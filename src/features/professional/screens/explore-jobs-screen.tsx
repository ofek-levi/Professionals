/**
 * Professional tab "Explore": open requests in the service area on a map or as a list, sharing one
 * filter state (services, distance, urgency, preferred date, competition, already offered).
 */
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { RequestCardSkeleton } from '@/components/requests';
import { ErrorState, Screen, ScreenHeader, SegmentedControl, Skeleton, useNow, type SegmentedOption } from '@/components/ui';
import { useOwnProfessionalProfile } from '@/hooks';
import { useFormatters } from '@/i18n/hooks';
import { makeStyles } from '@/theme';
import type { NearbyRequestSort } from '@/types/api';

import { ExploreFiltersSheet } from '../components/explore/explore-filters-sheet';
import { ExploreListView } from '../components/explore/explore-list-view';
import { ExploreMapView } from '../components/explore/explore-map-view';
import { ExploreSortSheet } from '../components/explore/explore-sort-sheet';
import { FiltersButton } from '../components/explore/filters-button';
import {
  countActiveFilters,
  DEFAULT_EXPLORE_FILTERS,
  DEFAULT_EXPLORE_SORT,
  filtersToParams,
  sanitizeFilters,
  type ExploreFilters,
  type ExploreViewMode,
} from '../explore-filters';

export default function ExploreJobsScreen() {
  const styles = useStyles();
  const { t } = useTranslation(['explore', 'common']);
  const format = useFormatters();
  const now = useNow(60_000);
  const profileQuery = useOwnProfessionalProfile();
  const profile = profileQuery.data;

  const [mode, setMode] = useState<ExploreViewMode>('map');
  const [appliedFilters, setAppliedFilters] = useState<ExploreFilters>(DEFAULT_EXPLORE_FILTERS);
  const [draft, setDraft] = useState<ExploreFilters>(DEFAULT_EXPLORE_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState<NearbyRequestSort>(DEFAULT_EXPLORE_SORT);
  const [sortOpen, setSortOpen] = useState(false);

  const filters = sanitizeFilters(appliedFilters, profile?.categoryIds, profile?.serviceArea.radiusKm);
  const params = filtersToParams(filters, now);
  const activeCount = countActiveFilters(filters);

  const openFilters = () => {
    setDraft(filters);
    setFiltersOpen(true);
  };
  const applyFilters = () => {
    setAppliedFilters(draft);
    setFiltersOpen(false);
  };
  const clearFilters = () => {
    setAppliedFilters(DEFAULT_EXPLORE_FILTERS);
    setDraft(DEFAULT_EXPLORE_FILTERS);
  };

  const modeOptions: SegmentedOption<ExploreViewMode>[] = [
    { value: 'map', label: t('explore:modes.map'), icon: 'map-outline' },
    { value: 'list', label: t('explore:modes.list'), icon: 'format-list-bulleted' },
  ];

  const header = (
    <View style={styles.header}>
      <ScreenHeader
        title={t('explore:title')}
        subtitle={
          profile
            ? t('explore:subtitle', { area: profile.serviceArea.label, distance: format.distance(profile.serviceArea.radiusKm) })
            : undefined
        }
        style={styles.screenHeader}
      />
      <View style={styles.controls}>
        <SegmentedControl options={modeOptions} value={mode} onChange={setMode} style={styles.segmented} testID="explore-mode" />
        <FiltersButton activeCount={activeCount} onPress={openFilters} />
      </View>
    </View>
  );

  let body;
  if (!profile) {
    body = profileQuery.isError ? (
      <ErrorState error={profileQuery.error} onRetry={() => void profileQuery.refetch()} retrying={profileQuery.isRefetching} />
    ) : mode === 'map' ? (
      <View style={styles.mapSkeleton}>
        <Skeleton width="100%" height={9999} radius={0} />
      </View>
    ) : (
      <View style={styles.listSkeleton}>
        {[0, 1, 2].map((index) => (
          <RequestCardSkeleton key={index} />
        ))}
      </View>
    );
  } else if (mode === 'map') {
    body = (
      <ExploreMapView
        serviceArea={profile.serviceArea}
        params={params}
        maxDistanceKm={filters.maxDistanceKm}
        hasFilters={activeCount > 0}
        onAdjustFilters={openFilters}
        onClearFilters={clearFilters}
      />
    );
  } else {
    body = (
      <ExploreListView
        params={params}
        sort={sort}
        onOpenSort={() => setSortOpen(true)}
        hasFilters={activeCount > 0}
        onAdjustFilters={openFilters}
        onClearFilters={clearFilters}
      />
    );
  }

  return (
    <Screen scroll={false} padded={false} header={header} maxContentWidth={false} testID="explore-screen">
      <View style={styles.body}>{body}</View>

      {profile ? (
        <ExploreFiltersSheet
          visible={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          draft={draft}
          onChangeDraft={setDraft}
          onApply={applyFilters}
          ownCategoryIds={profile.categoryIds}
          serviceRadiusKm={profile.serviceArea.radiusKm}
          now={now}
        />
      ) : null}
      <ExploreSortSheet visible={sortOpen} onClose={() => setSortOpen(false)} value={sort} onChange={setSort} />
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  header: {
    paddingHorizontal: t.spacing.screen,
    paddingBottom: t.spacing.md,
    gap: t.spacing.xs,
    width: '100%',
    maxWidth: t.layout.maxContentWidth,
    alignSelf: 'center',
  },
  screenHeader: {
    paddingBottom: t.spacing.md,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  segmented: {
    flex: 1,
  },
  body: {
    flex: 1,
  },
  mapSkeleton: {
    flex: 1,
    overflow: 'hidden',
  },
  listSkeleton: {
    paddingHorizontal: t.spacing.screen,
    paddingTop: t.spacing.md,
    gap: t.spacing.md,
  },
}));
