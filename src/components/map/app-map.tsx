/**
 * The app's map on every platform: Leaflet with free OpenStreetMap tiles, rendered by a WebView on
 * iOS/Android (`leaflet/leaflet-map.tsx`) and by a sandboxed iframe on the web
 * (`leaflet/leaflet-map.web.tsx`). This component maps props and the theme to the page state
 * (`map-page-state.ts`), keeps the camera API and draws the zoom buttons natively.
 */
import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { makeStyles, useTheme } from '@/theme';

import { IconButton } from '../ui/icon-button';
import { LeafletMap } from './leaflet/leaflet-map';
import type { LeafletMapHandle, MapStatus } from './leaflet/types';
import { buildMapPageState } from './map-page-state';
import { regionKey, resolveInitialRegion } from './map-region';
import type { AppMapCircle, AppMapMarker, AppMapProps } from './types';

const ANIMATION_MS = 350;
const NO_MARKERS: readonly AppMapMarker[] = [];
const NO_CIRCLES: readonly AppMapCircle[] = [];

export function AppMap({
  initialRegion,
  region,
  markers = NO_MARKERS,
  circles = NO_CIRCLES,
  onMarkerPress,
  onPress,
  onRegionChange,
  draggablePin,
  showZoomControls = false,
  interactive = true,
  controlInsets,
  accessibilityLabel,
  style,
  testID,
  ref,
}: AppMapProps) {
  const theme = useTheme();
  const styles = useStyles();
  const { t, i18n } = useTranslation('location');
  const reduceMotion = useReducedMotion();
  const mapRef = useRef<LeafletMapHandle>(null);
  const [status, setStatus] = useState<MapStatus>('loading');
  const [initial] = useState(() =>
    resolveInitialRegion({ region, initialRegion, markers, circles, pin: draggablePin }),
  );

  useImperativeHandle(ref, () => ({
    animateToRegion: (target, durationMs = ANIMATION_MS) => mapRef.current?.animateToRegion(target, durationMs),
  }));

  // Animate to the focus region whenever it changes (skip the initial mount).
  const focusKey = regionKey(region);
  const lastFocusKey = useRef(focusKey);
  useEffect(() => {
    if (!region || focusKey === lastFocusKey.current) return;
    lastFocusKey.current = focusKey;
    mapRef.current?.animateToRegion(region, ANIMATION_MS);
  }, [focusKey, region]);

  const label = accessibilityLabel ?? t('map.label');
  // Rebuilt every render; the bridge only sends it when its content changed.
  const state = buildMapPageState({
    theme,
    markers,
    circles,
    pin: draggablePin?.coordinate ?? null,
    interactive,
    reduceMotion,
    insets: controlInsets,
    labels: { map: label, pin: t('map.pin'), marker: (text) => t('map.marker', { label: text }) },
    lang: i18n.language,
  });

  return (
    <View
      style={[styles.container, style]}
      testID={testID}
      // A static preview is one image for screen readers; an interactive map exposes its markers.
      accessible={!interactive}
      accessibilityRole={interactive ? undefined : 'image'}
      accessibilityLabel={interactive ? undefined : label}
    >
      <LeafletMap
        ref={mapRef}
        state={state}
        initialRegion={initial}
        onMarkerPress={onMarkerPress}
        onMapPress={onPress}
        onPinDragEnd={draggablePin?.onChange}
        onRegionChange={onRegionChange}
        onStatusChange={setStatus}
        style={StyleSheet.absoluteFill}
      />
      {showZoomControls && interactive && status === 'ready' ? (
        <View style={[styles.zoom, { top: theme.spacing.md + (controlInsets?.top ?? 0), end: theme.spacing.md + (controlInsets?.end ?? 0) }]}>
          <IconButton
            icon="plus"
            variant="surface"
            accessibilityLabel={t('map.zoomIn')}
            onPress={() => mapRef.current?.zoomIn()}
            style={styles.zoomButton}
          />
          <IconButton
            icon="minus"
            variant="surface"
            accessibilityLabel={t('map.zoomOut')}
            onPress={() => mapRef.current?.zoomOut()}
            style={styles.zoomButton}
          />
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  container: {
    overflow: 'hidden',
    borderRadius: t.radii.lg,
    backgroundColor: t.colors.surfaceMuted,
    minHeight: 160,
  },
  zoom: {
    position: 'absolute',
    gap: t.spacing.sm,
  },
  zoomButton: {
    ...t.shadows.md,
  },
}));
