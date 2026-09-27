/**
 * Map mode of the job explorer: the service-area circle, one marker per matching open request
 * (colored by urgency, with the category glyph), an animated preview of the selected request,
 * floating "N jobs in your area" / recenter controls and an empty overlay.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, useReducedMotion } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { AppMap, type AppMapCircle, type AppMapMarker, type MapRegion } from '@/components/map';
import { AppText, Button, ErrorState, Icon, IconButton } from '@/components/ui';
import { URGENCY_META } from '@/constants/urgency-levels';
import { useCategoryLookup, useRefetchOnFocus } from '@/hooks';
import { useFormatters, useLocalizedText } from '@/i18n/hooks';
import { routes } from '@/lib/routes';
import { makeStyles, useTheme } from '@/theme';
import type { ServiceArea } from '@/types/domain';
import { regionForRadius } from '@/utils/geo';

import type { NearbyFilterParams } from '../../explore-filters';
import { MapRequestPreview } from './map-request-preview';
import { useExploreMapRequests } from './use-explore-map-requests';

export interface ExploreMapViewProps {
  serviceArea: ServiceArea;
  params: NearbyFilterParams;
  maxDistanceKm: number | null;
  hasFilters: boolean;
  onAdjustFilters: () => void;
  onClearFilters: () => void;
}

/** Nudges a region by a sub-meter amount so re-focusing the same region still animates. */
function nudge(region: MapRegion, generation: number): MapRegion {
  return { ...region, latitudeDelta: region.latitudeDelta * (1 + (generation % 2) * 0.0002) };
}

export function ExploreMapView({ serviceArea, params, maxDistanceKm, hasFilters, onAdjustFilters, onClearFilters }: ExploreMapViewProps) {
  const styles = useStyles();
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation(['explore', 'common']);
  const format = useFormatters();
  const localize = useLocalizedText();
  const catalog = useCategoryLookup();
  const reduceMotion = useReducedMotion();
  const query = useExploreMapRequests(params);
  useRefetchOnFocus(query.refetch);

  const homeRegion = regionForRadius(serviceArea.center, serviceArea.radiusKm);
  const areaKey = `${serviceArea.center.latitude}|${serviceArea.center.longitude}|${serviceArea.radiusKm}`;
  const [focus, setFocus] = useState<{ region: MapRegion; generation: number; areaKey: string }>({
    region: homeRegion,
    generation: 0,
    areaKey,
  });
  // The service area changed (profile edited): move the camera to the new area.
  if (focus.areaKey !== areaKey) setFocus({ region: nudge(homeRegion, focus.generation + 1), generation: focus.generation + 1, areaKey });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const requests = query.data?.items ?? [];
  const total = query.data?.totalCount ?? 0;
  const selected = requests.find((request) => request.id === selectedId) ?? null;

  const markers: AppMapMarker[] = requests.map((request) => {
    const category = catalog.getCategory(request.categoryId);
    const name = localize(category?.name) || t('common:category.unknown');
    return {
      id: request.id,
      coordinate: request.location.coordinates,
      tone: URGENCY_META[request.urgency].tone,
      icon: category?.icon ?? 'briefcase-outline',
      label: name,
      selected: request.id === selectedId,
      accessibilityLabel: t('explore:map.markerA11y', {
        category: name,
        urgency: t(`common:urgency.${request.urgency}.label`),
        distance: format.distance(request.distanceKm, { away: true }),
      }),
    };
  });

  const circles: AppMapCircle[] = [{ id: 'service-area', center: serviceArea.center, radiusKm: serviceArea.radiusKm, tone: 'brand' }];
  if (maxDistanceKm !== null && maxDistanceKm < serviceArea.radiusKm) {
    circles.push({ id: 'max-distance', center: serviceArea.center, radiusKm: maxDistanceKm, tone: 'accent' });
  }

  const recenter = () => {
    setSelectedId(null);
    setFocus((current) => ({ region: nudge(homeRegion, current.generation + 1), generation: current.generation + 1, areaKey }));
  };

  const showEmpty = query.data !== undefined && total === 0 && !query.isPlaceholderData;
  const entering = reduceMotion ? undefined : FadeInDown.duration(220);
  const exiting = reduceMotion ? undefined : FadeOutDown.duration(160);

  return (
    <View style={styles.container} testID="explore-map">
      <AppMap
        style={styles.map}
        initialRegion={homeRegion}
        region={focus.region}
        markers={markers}
        circles={circles}
        onMarkerPress={(id) => setSelectedId((current) => (current === id ? null : id))}
        onPress={() => setSelectedId(null)}
        accessibilityLabel={t('explore:map.label')}
        testID="explore-app-map"
      />

      {/* Floating status chip */}
      <View style={styles.topOverlay}>
        <View style={styles.countChip} accessibilityRole="text" accessibilityLiveRegion="polite">
          {query.isPending || query.isFetching ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <Icon name="briefcase-search-outline" size={16} color="primary" />
          )}
          <AppText variant="captionStrong" numberOfLines={1} tabular>
            {query.isPending ? t('explore:loadingJobs') : t('explore:jobsInArea', { count: total })}
          </AppText>
        </View>
      </View>

      {query.isError && query.data === undefined ? (
        <View style={styles.centerOverlay}>
          <View style={styles.overlayCard}>
            <ErrorState compact error={query.error} onRetry={() => void query.refetch()} retrying={query.isRefetching} />
          </View>
        </View>
      ) : null}

      {showEmpty ? (
        <View style={styles.centerOverlay}>
          <View style={styles.overlayCard} testID="explore-map-empty">
            <View style={styles.emptyIcon}>
              <Icon name={hasFilters ? 'filter-remove-outline' : 'map-search-outline'} size={28} color="primary" />
            </View>
            <AppText variant="subheading" align="center">
              {hasFilters ? t('explore:empty.filteredTitle') : t('explore:empty.areaTitle')}
            </AppText>
            <AppText variant="caption" color="secondary" align="center">
              {hasFilters ? t('explore:empty.filteredDescription') : t('explore:empty.areaDescription')}
            </AppText>
            <View style={styles.emptyActions}>
              {hasFilters ? (
                <Button label={t('explore:empty.adjustFilters')} size="sm" leftIcon="tune-variant" onPress={onAdjustFilters} fullWidth />
              ) : null}
              <Button
                label={t('explore:empty.expandArea')}
                size="sm"
                variant={hasFilters ? 'secondary' : 'primary'}
                leftIcon="map-marker-radius-outline"
                onPress={() => router.push(routes.editProfile)}
                fullWidth
              />
              {hasFilters ? (
                <Button label={t('explore:empty.clearFilters')} size="sm" variant="ghost" onPress={onClearFilters} fullWidth />
              ) : null}
            </View>
          </View>
        </View>
      ) : null}

      {/* Bottom: recenter + preview */}
      <View style={styles.bottomOverlay}>
        <View style={styles.recenterRow}>
          <IconButton
            icon="crosshairs-gps"
            variant="surface"
            size="lg"
            color="primary"
            accessibilityLabel={t('explore:recenter')}
            onPress={recenter}
            style={styles.recenter}
            testID="explore-recenter"
          />
        </View>
        {selected ? (
          <Animated.View key={selected.id} entering={entering} exiting={exiting}>
            <MapRequestPreview
              request={selected}
              onOpen={() => router.push(routes.request(selected.id))}
              onClose={() => setSelectedId(null)}
            />
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
    borderRadius: 0,
  },
  topOverlay: {
    position: 'absolute',
    pointerEvents: 'box-none',
    top: t.spacing.md,
    start: t.spacing.lg,
    end: 72,
    flexDirection: 'row',
  },
  countChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    minHeight: 40,
    paddingHorizontal: t.spacing.md,
    borderRadius: t.radii.pill,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
    flexShrink: 1,
    ...t.shadows.md,
  },
  centerOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    start: 0,
    end: 0,
    pointerEvents: 'box-none',
    alignItems: 'center',
    justifyContent: 'center',
    padding: t.spacing.xxl,
  },
  overlayCard: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    gap: t.spacing.sm,
    padding: t.spacing.xl,
    borderRadius: t.radii.xl,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
    ...t.shadows.lg,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.primarySoft,
    marginBottom: t.spacing.xs,
  },
  emptyActions: {
    alignSelf: 'stretch',
    gap: t.spacing.sm,
    marginTop: t.spacing.sm,
  },
  bottomOverlay: {
    position: 'absolute',
    pointerEvents: 'box-none',
    start: t.spacing.lg,
    end: t.spacing.lg,
    bottom: t.spacing.lg,
    gap: t.spacing.md,
  },
  recenterRow: {
    pointerEvents: 'box-none',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  recenter: {
    ...t.shadows.md,
  },
}));
