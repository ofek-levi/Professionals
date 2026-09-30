/**
 * Map mode of the job explorer: the service-area circle, one marker per matching open request
 * (colored by urgency, with the category glyph), a compact preview of the selected request, a
 * floating "N jobs in your area" chip, a recenter button and a one-line empty overlay.
 */
import { useRouter } from 'expo-router';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { ActivityIndicator, View, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, useReducedMotion } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { AppMap, type AppMapCircle, type AppMapHandle, type AppMapInsets, type AppMapMarker } from '@/components/map';
import { AppText, Button, ErrorState, IconButton } from '@/components/ui';
import { URGENCY_META } from '@/constants/urgency-levels';
import { useCategoryLookup, useNearbyRequestsForMap, useRefetchOnFocus } from '@/hooks';
import { useFormatters, useLocalizedText } from '@/i18n/hooks';
import { routes } from '@/lib/routes';
import { makeStyles, useTheme } from '@/theme';
import type { ServiceArea } from '@/types/domain';
import { regionForRadius } from '@/utils/geo';

import type { NearbyFilterParams } from '../../explore-filters';
import { MapRequestPreview } from './map-request-preview';

/** Height of a measured overlay (state setter for `onLayout`). */
const measureHeight = (setHeight: (height: number) => void) => (event: LayoutChangeEvent) =>
  setHeight(Math.ceil(event.nativeEvent.layout.height));

interface ExploreMapViewProps {
  serviceArea: ServiceArea;
  params: NearbyFilterParams;
  maxDistanceKm: number | null;
  hasFilters: boolean;
  onAdjustFilters: () => void;
  onClearFilters: () => void;
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
  const query = useNearbyRequestsForMap(params);
  useRefetchOnFocus(query.refetch);

  // The camera follows the service area (it animates when the profile's area changes); the
  // recenter button brings it back after the user panned away.
  const homeRegion = regionForRadius(serviceArea.center, serviceArea.radiusKm);
  const mapRef = useRef<AppMapHandle>(null);
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

  // The floating chip, the recenter button and the preview card cover the map's edges: the
  // attribution, camera fitting and the selected marker keep clear of them (offsets and gap as in
  // `topOverlay` / `bottomOverlay` below).
  const [chipHeight, setChipHeight] = useState(0);
  const [recenterHeight, setRecenterHeight] = useState(0);
  const [previewHeight, setPreviewHeight] = useState(0);
  const { spacing } = theme;
  const controlInsets: AppMapInsets = {
    top: spacing.md + chipHeight,
    bottom: spacing.lg + recenterHeight + (selected ? spacing.md + previewHeight : 0),
  };

  // Recentering closes the preview first; the camera moves after that render, so the service area
  // is fitted without the card's inset.
  const [recenterCount, setRecenterCount] = useState(0);
  const moveHome = useEffectEvent(() => mapRef.current?.animateToRegion(homeRegion));
  useEffect(() => {
    if (recenterCount > 0) moveHome();
  }, [recenterCount]);
  const recenter = () => {
    setSelectedId(null);
    setRecenterCount((count) => count + 1);
  };

  const showEmpty = query.data !== undefined && total === 0 && !query.isPlaceholderData;
  const entering = reduceMotion ? undefined : FadeInDown.duration(220);
  const exiting = reduceMotion ? undefined : FadeOutDown.duration(160);

  return (
    <View style={styles.container} testID="explore-map">
      <AppMap
        ref={mapRef}
        style={styles.map}
        initialRegion={homeRegion}
        region={homeRegion}
        markers={markers}
        circles={circles}
        onMarkerPress={(id) => setSelectedId((current) => (current === id ? null : id))}
        onPress={() => setSelectedId(null)}
        controlInsets={controlInsets}
        accessibilityLabel={t('explore:map.label')}
        testID="explore-app-map"
      />

      {/* Floating status chip */}
      <View style={styles.topOverlay} onLayout={measureHeight(setChipHeight)}>
        <View style={styles.countChip} accessibilityRole="text" accessibilityLiveRegion="polite">
          {query.isPending || query.isFetching ? <ActivityIndicator size="small" color={theme.colors.primary} /> : null}
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
            <AppText variant="bodyStrong" align="center">
              {hasFilters ? t('explore:empty.filteredTitle') : t('explore:empty.areaTitle')}
            </AppText>
            <Button
              label={hasFilters ? t('explore:empty.clearFilters') : t('explore:empty.expandArea')}
              size="sm"
              variant="secondary"
              onPress={hasFilters ? onClearFilters : () => router.push(routes.editServiceArea)}
              style={styles.centered}
            />
            {hasFilters ? (
              <Button label={t('explore:empty.adjustFilters')} size="sm" variant="ghost" onPress={onAdjustFilters} style={styles.centered} />
            ) : null}
          </View>
        </View>
      ) : null}

      {/* Bottom: recenter + preview */}
      <View style={styles.bottomOverlay}>
        <View style={styles.recenterRow} onLayout={measureHeight(setRecenterHeight)}>
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
          <Animated.View key={selected.id} entering={entering} exiting={exiting} onLayout={measureHeight(setPreviewHeight)}>
            <MapRequestPreview request={selected} onOpen={() => router.push(routes.request(selected.id))} />
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
    minHeight: 36,
    paddingHorizontal: t.spacing.md,
    borderRadius: t.radii.pill,
    backgroundColor: t.colors.surfaceElevated,
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
    maxWidth: 320,
    alignItems: 'center',
    gap: t.spacing.md,
    padding: t.spacing.xl,
    borderRadius: t.radii.lg,
    backgroundColor: t.colors.surfaceElevated,
    ...t.shadows.lg,
  },
  centered: {
    alignSelf: 'center',
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
