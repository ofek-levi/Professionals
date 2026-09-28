/**
 * Turns `AppMap` props and the theme into the page state the Leaflet page renders (pure: colors,
 * glyphs, labels and insets are resolved here, so the page never needs the theme or i18n).
 */
import { MAP_TILES, type MapTileConfig } from '@/constants/map-tiles';
import type { Theme } from '@/theme';
import type { GeoCoordinates } from '@/types/domain';
import { isValidCoordinates } from '@/utils/geo';

import { withAlpha } from '../ui/colors';
import type { MapPageState, PageInsets } from './leaflet/map-protocol';
import { resolveMarkerIcon } from './leaflet/marker-icons';
import type { AppMapCircle, AppMapInsets, AppMapMarker } from './types';

interface PageStateInput {
  theme: Theme;
  markers: readonly AppMapMarker[];
  circles: readonly AppMapCircle[];
  pin: GeoCoordinates | null;
  interactive: boolean;
  /** Mouse-wheel zoom (default `true`; off inside scrolling screens). */
  wheelZoom?: boolean;
  reduceMotion: boolean;
  insets?: AppMapInsets;
  /** Localized accessibility texts. */
  labels: { map: string; pin: string; marker: (label: string) => string };
  lang: string;
  tiles?: MapTileConfig;
}

const cleanInset = (value: number | undefined) => (value !== undefined && Number.isFinite(value) && value > 0 ? value : 0);

/** Logical insets → physical ones (the map itself is never mirrored). */
export function resolvePageInsets(insets: AppMapInsets | undefined, isRTL: boolean): PageInsets {
  const start = cleanInset(insets?.start);
  const end = cleanInset(insets?.end);
  return {
    top: cleanInset(insets?.top),
    bottom: cleanInset(insets?.bottom),
    left: isRTL ? end : start,
    right: isRTL ? start : end,
  };
}

export function buildMapPageState({
  theme,
  markers,
  circles,
  pin,
  interactive,
  wheelZoom = true,
  reduceMotion,
  insets,
  labels,
  lang,
  tiles = MAP_TILES,
}: PageStateInput): MapPageState {
  const { colors } = theme;
  return {
    markers: markers
      .filter((marker) => isValidCoordinates(marker.coordinate))
      .map((marker) => {
        const tone = colors.tones[marker.tone ?? 'brand'];
        return {
          id: marker.id,
          latitude: marker.coordinate.latitude,
          longitude: marker.coordinate.longitude,
          color: tone.solid,
          ring: withAlpha(tone.solid, 0.25),
          icon: resolveMarkerIcon(marker.icon),
          label: marker.label ?? null,
          selected: marker.selected === true,
          accessibilityLabel: marker.accessibilityLabel ?? (marker.label ? labels.marker(marker.label) : null),
        };
      }),
    circles: circles
      .filter((circle) => isValidCoordinates(circle.center) && Number.isFinite(circle.radiusKm) && circle.radiusKm > 0)
      .map((circle, index) => ({
        id: circle.id ?? `circle-${index}`,
        latitude: circle.center.latitude,
        longitude: circle.center.longitude,
        radiusMeters: circle.radiusKm * 1000,
        color: colors.tones[circle.tone ?? 'brand'].solid,
      })),
    pin: pin && isValidCoordinates(pin) ? { latitude: pin.latitude, longitude: pin.longitude, accessibilityLabel: labels.pin } : null,
    theme: {
      dark: theme.scheme === 'dark',
      background: colors.surfaceMuted,
      grid: colors.borderStrong,
      surface: colors.surfaceElevated,
      text: colors.text,
      mutedText: colors.textSecondary,
      border: colors.border,
      link: colors.primary,
      pin: colors.primaryFill,
      onColor: colors.onPrimary,
      shadow: colors.shadow,
      overlay: colors.overlay,
      controlBackground: withAlpha(colors.surfaceElevated, 0.85),
    },
    tiles: { urlTemplate: tiles.urlTemplate, maxZoom: tiles.maxZoom, attribution: tiles.attribution },
    rtl: theme.isRTL,
    interactive,
    wheelZoom: interactive && wheelZoom,
    reduceMotion,
    insets: resolvePageInsets(insets, theme.isRTL),
    accessibilityLabel: labels.map,
    lang,
  };
}
