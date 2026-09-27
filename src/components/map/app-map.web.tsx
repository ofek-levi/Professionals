/**
 * Web map: an interactive, dependency-free canvas (react-native-maps has no web support).
 *
 * - Stylized city look (streets/avenues/parks) generated deterministically from the grid, so it stays
 *   stable while panning.
 * - Equirectangular projection of the viewport (see `map-projection.ts`).
 * - Same marker visuals as native, radius circles, tap-to-place, draggable pin, drag-to-pan and
 *   zoom buttons.
 *
 * Geometry uses physical `left`/`top` on purpose: a map never mirrors in RTL, and react-native-web
 * only localizes logical (`start`/`end`) properties. Overlay controls still follow the layout
 * direction.
 */
import { useImperativeHandle, useRef, useState, type ReactElement } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useTranslation } from 'react-i18next';

import { makeStyles, useTheme } from '@/theme';
import type { GeoCoordinates } from '@/types/domain';

import { AppText } from '../ui/app-text';
import { withAlpha } from '../ui/colors';
import { Icon } from '../ui/icon';
import { IconButton } from '../ui/icon-button';
import { usePanGesture, type PanGestureHandlers } from '../ui/pan-gesture';
import { LocationPin, MARKER_SELECTED_SIZE, MARKER_SIZE, MarkerBubble, PIN_HEAD_SIZE, PIN_STEM_HEIGHT } from './map-markers';
import {
  cellHash,
  clampLatitudeDelta,
  gridStep,
  latitudeDeltaToFit,
  longitudeDelta,
  pixelsPerKm,
  project,
  unproject,
  viewportToRegion,
  type Point,
  type Viewport,
} from './map-projection';
import { regionKey, resolveInitialRegion } from './map-region';
import type { AppMapProps, MapRegion } from './types';

interface Camera {
  center: GeoCoordinates;
  latitudeDelta: number;
}

const TAP_SLOP = 5;
const OFFSCREEN_MARGIN = 80;
/** Pin height from its tip to the top of the head. */
const PIN_TOTAL_HEIGHT = PIN_HEAD_SIZE + PIN_STEM_HEIGHT - 2;

const clampLatitude = (value: number) => Math.min(Math.max(value, -85), 85);

export function AppMap({
  initialRegion,
  region,
  markers = [],
  circles = [],
  onMarkerPress,
  onPress,
  onRegionChangeComplete,
  draggablePin,
  fitToMarkers = false,
  showZoomControls = true,
  interactive = true,
  accessibilityLabel,
  style,
  testID,
  ref,
}: AppMapProps) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation('location');
  const [initial] = useState(() =>
    resolveInitialRegion({ region, initialRegion, fitToMarkers, markers, circles, pin: draggablePin }),
  );
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [camera, setCamera] = useState<Camera>({
    center: { latitude: initial.latitude, longitude: initial.longitude },
    latitudeDelta: initial.latitudeDelta,
  });
  const [pinOffset, setPinOffset] = useState<Point | null>(null);
  // Gesture origin lives in a ref: it is only read by event handlers and must be available even if
  // the release arrives before a re-render.
  const gesture = useRef<{ center: GeoCoordinates; tap: Point } | null>(null);

  const cameraFor = (target: MapRegion): Camera => ({
    center: { latitude: target.latitude, longitude: target.longitude },
    latitudeDelta: size.width > 0 ? latitudeDeltaToFit(target, size.width, size.height) : target.latitudeDelta,
  });

  // Focus region changed → move the camera (adjusting state while rendering, no effect needed).
  const focusKey = regionKey(region);
  const [appliedFocusKey, setAppliedFocusKey] = useState(focusKey);
  if (focusKey !== appliedFocusKey) {
    setAppliedFocusKey(focusKey);
    if (region) setCamera(cameraFor(region));
  }

  useImperativeHandle(ref, () => ({
    animateToRegion: (target) => setCamera(cameraFor(target)),
  }));

  const viewport: Viewport = { ...camera, width: size.width, height: size.height };

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (size.width === 0 && width > 0) {
      // First measurement: fit the initial region into the real canvas size.
      setCamera((current) => ({ ...current, latitudeDelta: latitudeDeltaToFit(region ?? initial, width, height) }));
    }
    setSize({ width, height });
  };

  const canvasHandlers = usePanGesture({
    claimOnStart: true,
    claimOnMove: (g) => Math.abs(g.dx) + Math.abs(g.dy) > TAP_SLOP,
    onGrant: (event) => {
      gesture.current = { center: camera.center, tap: { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY } };
    },
    onMove: (g) => {
      const start = gesture.current;
      if (!interactive || !start || size.width === 0) return;
      const lngDelta = longitudeDelta(viewport);
      setCamera((current) => ({
        ...current,
        center: {
          latitude: clampLatitude(start.center.latitude + (g.dy / size.height) * current.latitudeDelta),
          longitude: start.center.longitude - (g.dx / size.width) * lngDelta,
        },
      }));
    },
    onRelease: (g) => {
      const start = gesture.current;
      gesture.current = null;
      if (!start) return;
      if (Math.abs(g.dx) < TAP_SLOP && Math.abs(g.dy) < TAP_SLOP) {
        onPress?.(unproject(viewport, start.tap));
      } else if (interactive) {
        onRegionChangeComplete?.(viewportToRegion(viewport));
      }
    },
    onTerminate: () => {
      gesture.current = null;
    },
  });

  const pinHandlers = usePanGesture({
    claimOnStart: Boolean(draggablePin),
    lockResponder: true,
    onGrant: () => setPinOffset({ x: 0, y: 0 }),
    onMove: (g) => setPinOffset({ x: g.dx, y: g.dy }),
    onRelease: (g) => {
      setPinOffset(null);
      if (!draggablePin) return;
      const start = project(viewport, draggablePin.coordinate);
      draggablePin.onChange(unproject(viewport, { x: start.x + g.dx, y: start.y + g.dy }));
    },
    onTerminate: () => setPinOffset(null),
  });

  const zoom = (factor: number) => {
    const next = { ...camera, latitudeDelta: clampLatitudeDelta(camera.latitudeDelta * factor) };
    setCamera(next);
    onRegionChangeComplete?.(viewportToRegion({ ...next, width: size.width, height: size.height }));
  };

  const ready = size.width > 0 && size.height > 0;

  return (
    <View
      style={[styles.container, style]}
      onLayout={handleLayout}
      testID={testID}
      accessibilityLabel={accessibilityLabel ?? t('map.label')}
    >
      {ready ? (
        <View style={[StyleSheet.absoluteFill, styles.canvas]} {...(interactive || onPress ? canvasHandlers : null)}>
          <View style={[StyleSheet.absoluteFill, styles.decor]}>
            <CityBackdrop viewport={viewport} />
            {circles.map((circle, index) => {
              const center = project(viewport, circle.center);
              const radius = circle.radiusKm * pixelsPerKm(viewport);
              const tone = theme.colors.tones[circle.tone ?? 'brand'];
              return (
                <View
                  key={circle.id ?? `circle-${index}`}
                  style={{
                    position: 'absolute',
                    left: center.x - radius,
                    top: center.y - radius,
                    width: radius * 2,
                    height: radius * 2,
                    borderRadius: radius,
                    borderWidth: 2,
                    borderColor: tone.solid,
                    backgroundColor: withAlpha(tone.solid, 0.12),
                  }}
                />
              );
            })}
          </View>

          {markers.map((marker) => {
            const point = project(viewport, marker.coordinate);
            if (
              point.x < -OFFSCREEN_MARGIN ||
              point.y < -OFFSCREEN_MARGIN ||
              point.x > size.width + OFFSCREEN_MARGIN ||
              point.y > size.height + OFFSCREEN_MARGIN
            ) {
              return null;
            }
            const box = (marker.selected ? MARKER_SELECTED_SIZE : MARKER_SIZE) + 12;
            return (
              <Pressable
                key={marker.id}
                accessibilityRole="button"
                accessibilityLabel={marker.accessibilityLabel ?? (marker.label ? t('map.marker', { label: marker.label }) : undefined)}
                accessibilityState={{ selected: Boolean(marker.selected) }}
                onPress={() => onMarkerPress?.(marker.id)}
                style={{
                  position: 'absolute',
                  left: point.x - box / 2,
                  top: point.y - box / 2,
                  width: box,
                  height: box,
                  zIndex: marker.selected ? 2 : 1,
                }}
              >
                <MarkerBubble tone={marker.tone} icon={marker.icon} label={marker.label} selected={marker.selected} />
              </Pressable>
            );
          })}

          {draggablePin ? (
            <PinLayer viewport={viewport} coordinate={draggablePin.coordinate} offset={pinOffset} handlers={pinHandlers} label={t('map.pin')} />
          ) : null}
        </View>
      ) : null}

      {showZoomControls && interactive && ready ? (
        <View style={styles.zoom}>
          <IconButton icon="plus" variant="surface" accessibilityLabel={t('map.zoomIn')} onPress={() => zoom(0.5)} />
          <IconButton icon="minus" variant="surface" accessibilityLabel={t('map.zoomOut')} onPress={() => zoom(2)} />
        </View>
      ) : null}

      <View style={styles.previewBadge}>
        <Icon name="map-outline" size={12} color="muted" />
        <AppText variant="tiny" color="muted">
          {t('map.preview')}
        </AppText>
      </View>
    </View>
  );
}

function PinLayer({
  viewport,
  coordinate,
  offset,
  handlers,
  label,
}: {
  viewport: Viewport;
  coordinate: GeoCoordinates;
  offset: Point | null;
  handlers: PanGestureHandlers;
  label: string;
}) {
  const point = project(viewport, coordinate);
  return (
    <View
      {...handlers}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      style={{
        position: 'absolute',
        left: point.x - PIN_HEAD_SIZE / 2 + (offset?.x ?? 0),
        top: point.y - PIN_TOTAL_HEIGHT + (offset?.y ?? 0),
        zIndex: 3,
      }}
    >
      <LocationPin lifted={offset !== null} />
    </View>
  );
}

/** Deterministic "city": land, parks, streets and avenues aligned to a geographic grid. */
function CityBackdrop({ viewport }: { viewport: Viewport }) {
  const theme = useTheme();
  const { width, height } = viewport;
  const latStep = gridStep(viewport);
  // Square blocks: scale the longitude step with a coarse latitude so lines don't drift while panning.
  const roundedLatitude = Math.round(viewport.center.latitude * 2) / 2;
  const lngStep = latStep / Math.max(Math.cos((roundedLatitude * Math.PI) / 180), 0.01);
  const lngDelta = longitudeDelta(viewport);

  const minLat = viewport.center.latitude - viewport.latitudeDelta / 2;
  const maxLat = viewport.center.latitude + viewport.latitudeDelta / 2;
  const minLng = viewport.center.longitude - lngDelta / 2;
  const maxLng = viewport.center.longitude + lngDelta / 2;
  const rowStart = Math.floor(minLat / latStep) - 1;
  const rowEnd = Math.ceil(maxLat / latStep) + 1;
  const colStart = Math.floor(minLng / lngStep) - 1;
  const colEnd = Math.ceil(maxLng / lngStep) + 1;

  const y = (latitude: number) => project(viewport, { latitude, longitude: viewport.center.longitude }).y;
  const x = (longitude: number) => project(viewport, { latitude: viewport.center.latitude, longitude }).x;

  const elements: ReactElement[] = [];
  const park = theme.colors.tones.success.bg;
  const water = theme.colors.tones.info.bg;

  // Blocks: a few parks and ponds.
  for (let row = rowStart; row < rowEnd; row += 1) {
    for (let col = colStart; col < colEnd; col += 1) {
      const hash = cellHash(row, col);
      const kind = hash % 13 === 0 ? 'park' : hash % 41 === 7 ? 'water' : null;
      if (!kind) continue;
      const top = y((row + 1) * latStep);
      const bottom = y(row * latStep);
      const left = x(col * lngStep);
      const right = x((col + 1) * lngStep);
      elements.push(
        <View
          key={`b${row}:${col}`}
          style={{
            position: 'absolute',
            left: left + 5,
            top: top + 5,
            width: Math.max(0, right - left - 10),
            height: Math.max(0, bottom - top - 10),
            borderRadius: kind === 'water' ? 999 : 6,
            backgroundColor: kind === 'park' ? park : water,
          }}
        />,
      );
    }
  }

  // Streets (minor lines are sometimes missing to look less like graph paper) and avenues.
  const casing = theme.colors.border;
  const road = theme.scheme === 'dark' ? theme.colors.surfacePressed : theme.colors.surface;
  for (let row = rowStart; row <= rowEnd; row += 1) {
    const major = row % 4 === 0;
    if (!major && cellHash(row, 7) % 5 === 0) continue;
    const top = y(row * latStep);
    const thickness = major ? 7 : 3;
    if (major) elements.push(<View key={`hc${row}`} style={{ position: 'absolute', left: 0, width, top: top - (thickness + 2) / 2, height: thickness + 2, backgroundColor: casing }} />);
    elements.push(<View key={`h${row}`} style={{ position: 'absolute', left: 0, width, top: top - thickness / 2, height: thickness, backgroundColor: road }} />);
  }
  for (let col = colStart; col <= colEnd; col += 1) {
    const major = col % 4 === 0;
    if (!major && cellHash(col, 11) % 5 === 0) continue;
    const left = x(col * lngStep);
    const thickness = major ? 7 : 3;
    if (major) elements.push(<View key={`vc${col}`} style={{ position: 'absolute', top: 0, height, left: left - (thickness + 2) / 2, width: thickness + 2, backgroundColor: casing }} />);
    elements.push(<View key={`v${col}`} style={{ position: 'absolute', top: 0, height, left: left - thickness / 2, width: thickness, backgroundColor: road }} />);
  }

  return <>{elements}</>;
}

const useStyles = makeStyles((t) => ({
  container: {
    overflow: 'hidden',
    borderRadius: t.radii.lg,
    backgroundColor: t.colors.surfaceMuted,
    minHeight: 160,
  },
  canvas: {
    backgroundColor: t.colors.surfaceMuted,
  },
  decor: {
    pointerEvents: 'none',
  },
  zoom: {
    position: 'absolute',
    top: t.spacing.md,
    end: t.spacing.md,
    gap: t.spacing.sm,
  },
  previewBadge: {
    position: 'absolute',
    pointerEvents: 'none',
    bottom: t.spacing.sm,
    start: t.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
    paddingHorizontal: t.spacing.sm,
    paddingVertical: t.spacing.xxs,
    borderRadius: t.radii.pill,
    backgroundColor: withAlpha(t.colors.surface, 0.85),
  },
}));
