/**
 * Native map (iOS: Apple Maps, Android: Google Maps) built on `react-native-maps`.
 * The web build resolves `app-map.web.tsx` instead, which never imports `react-native-maps`.
 */
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { Circle, Marker, PROVIDER_DEFAULT, type MapStyleElement } from 'react-native-maps';
import { useTranslation } from 'react-i18next';

import { makeStyles, useTheme, type Theme } from '@/theme';

import { withAlpha } from '../ui/colors';
import { IconButton } from '../ui/icon-button';
import { LocationPin, MarkerBubble } from './map-markers';
import { contentCoordinates, regionKey, resolveInitialRegion } from './map-region';
import type { AppMapMarker, AppMapProps, MapRegion } from './types';

const EDGE_PADDING = { top: 72, right: 56, bottom: 72, left: 56 };
const ANIMATION_MS = 350;

/** Google Maps dark style derived from theme tokens (Android; iOS uses `userInterfaceStyle`). */
function darkMapStyle(theme: Theme): MapStyleElement[] {
  const { colors } = theme;
  return [
    { elementType: 'geometry', stylers: [{ color: colors.surface }] },
    { elementType: 'labels.text.fill', stylers: [{ color: colors.textMuted }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: colors.background }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: colors.surfaceMuted }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: colors.borderStrong }] },
    { featureType: 'poi', elementType: 'geometry', stylers: [{ color: colors.surfaceMuted }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: colors.background }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  ];
}

function MarkerItem({ marker, onPress }: { marker: AppMapMarker; onPress?: (id: string) => void }) {
  // Custom marker views are rasterized; track changes only briefly after (re)mount for performance.
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setTracksViewChanges(false), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Marker
      coordinate={marker.coordinate}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracksViewChanges}
      zIndex={marker.selected ? 10 : 1}
      accessibilityLabel={marker.accessibilityLabel ?? marker.label}
      onPress={(event) => {
        event.stopPropagation();
        onPress?.(marker.id);
      }}
    >
      <MarkerBubble tone={marker.tone} icon={marker.icon} label={marker.label} selected={marker.selected} />
    </Marker>
  );
}

export function AppMap({
  initialRegion,
  region,
  markers = [],
  circles = [],
  onMarkerPress,
  onPress,
  onRegionChangeComplete,
  draggablePin,
  showsUserLocation = false,
  fitToMarkers = false,
  showZoomControls = false,
  interactive = true,
  accessibilityLabel,
  style,
  testID,
}: AppMapProps) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation('location');
  const mapRef = useRef<MapView>(null);
  const [initial] = useState(() =>
    resolveInitialRegion({ region, initialRegion, fitToMarkers, markers, circles, pin: draggablePin }),
  );
  const [currentRegion, setCurrentRegion] = useState<MapRegion>(initial);

  // Animate to the focus region whenever it changes (skip the initial mount).
  const focusKey = regionKey(region);
  const lastFocusKey = useRef(focusKey);
  useEffect(() => {
    if (!region || focusKey === lastFocusKey.current) return;
    lastFocusKey.current = focusKey;
    mapRef.current?.animateToRegion(region, ANIMATION_MS);
  }, [focusKey, region]);

  const fitContent = () => {
    if (!fitToMarkers) return;
    const points = contentCoordinates(markers, circles, draggablePin);
    if (points.length > 1) mapRef.current?.fitToCoordinates(points, { edgePadding: EDGE_PADDING, animated: false });
  };

  const zoom = (factor: number) => {
    mapRef.current?.animateToRegion(
      {
        ...currentRegion,
        latitudeDelta: Math.min(Math.max(currentRegion.latitudeDelta * factor, 0.002), 60),
        longitudeDelta: Math.min(Math.max(currentRegion.longitudeDelta * factor, 0.002), 60),
      },
      250,
    );
  };

  return (
    <View style={[styles.container, style]} testID={testID}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={StyleSheet.absoluteFill}
        initialRegion={initial}
        accessibilityLabel={accessibilityLabel ?? t('map.label')}
        onMapReady={fitContent}
        onPress={(event) => onPress?.(event.nativeEvent.coordinate)}
        onRegionChangeComplete={(next) => {
          setCurrentRegion(next);
          onRegionChangeComplete?.(next);
        }}
        showsUserLocation={showsUserLocation}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        userInterfaceStyle={theme.scheme}
        customMapStyle={Platform.OS === 'android' && theme.scheme === 'dark' ? darkMapStyle(theme) : undefined}
      >
        {circles.map((circle, index) => {
          const tone = theme.colors.tones[circle.tone ?? 'brand'];
          return (
            <Circle
              key={circle.id ?? `circle-${index}`}
              center={circle.center}
              radius={circle.radiusKm * 1000}
              strokeColor={tone.solid}
              strokeWidth={2}
              fillColor={withAlpha(tone.solid, 0.12)}
            />
          );
        })}
        {markers.map((marker) => (
          <MarkerItem
            // Re-mount on visual changes so the rasterized marker view is refreshed.
            key={`${marker.id}:${marker.selected ? 1 : 0}:${marker.tone ?? ''}:${marker.icon ?? ''}:${marker.label ?? ''}`}
            marker={marker}
            onPress={onMarkerPress}
          />
        ))}
        {draggablePin ? (
          <Marker
            coordinate={draggablePin.coordinate}
            draggable
            anchor={{ x: 0.5, y: 1 }}
            zIndex={20}
            accessibilityLabel={t('map.pin')}
            onDragEnd={(event) => draggablePin.onChange(event.nativeEvent.coordinate)}
          >
            <LocationPin />
          </Marker>
        ) : null}
      </MapView>
      {showZoomControls && interactive ? (
        <View style={styles.zoom}>
          <IconButton icon="plus" variant="surface" accessibilityLabel={t('map.zoomIn')} onPress={() => zoom(0.5)} />
          <IconButton icon="minus" variant="surface" accessibilityLabel={t('map.zoomOut')} onPress={() => zoom(2)} />
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
    top: t.spacing.md,
    end: t.spacing.md,
    gap: t.spacing.sm,
  },
}));
