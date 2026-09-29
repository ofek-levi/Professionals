import type { Ref } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import type { StatusTone } from '@/constants/tones';
import type { GeoCoordinates } from '@/types/domain';
import type { MapRegion } from '@/utils/geo';

import type { IconSource } from '../ui/icon';

export type { MapRegion };

export interface AppMapMarker {
  id: string;
  coordinate: GeoCoordinates;
  /** Marker color (default `brand`). */
  tone?: StatusTone;
  /**
   * Glyph inside the marker (default `map-marker`). Category icons and the few extras in
   * `leaflet/marker-icons.ts` are available; other names show a neutral glyph.
   */
  icon?: IconSource;
  /** Short text shown under the marker when selected (e.g. category name or price). */
  label?: string;
  /** Drawn larger with a halo and its label; a newly selected marker is panned clear of `controlInsets`. */
  selected?: boolean;
  accessibilityLabel?: string;
}

export interface AppMapCircle {
  id?: string;
  center: GeoCoordinates;
  radiusKm: number;
  tone?: StatusTone;
}

export interface AppMapDraggablePin {
  coordinate: GeoCoordinates;
  /** Called when the user finishes dragging the pin. */
  onChange: (coordinate: GeoCoordinates) => void;
}

/**
 * Edges of the map covered by overlays (floating cards, chips), in points. The attribution, the
 * zoom buttons, camera fitting (`initialRegion`, `region`, `animateToRegion`) and a newly selected
 * marker keep clear of them. Pass measured overlay sizes; changes apply without moving the camera
 * (except to bring the selected marker into view).
 */
export interface AppMapInsets {
  top?: number;
  bottom?: number;
  start?: number;
  end?: number;
}

/** Imperative camera control (`const mapRef = useRef<AppMapHandle>(null)`, `<AppMap ref={mapRef} />`). */
export interface AppMapHandle {
  /**
   * Moves the camera to `region`, even when it equals the current `region` prop (e.g. a "recenter"
   * button after the user panned away). Animates for `durationMs` (default 350); instant with
   * Reduce Motion.
   */
  animateToRegion: (region: MapRegion, durationMs?: number) => void;
}

/**
 * The app's map (iOS, Android and web): Leaflet with OpenStreetMap tiles, rendered in a WebView on
 * native and a sandboxed iframe on the web (see `leaflet/`).
 */
export interface AppMapProps {
  /** Initial viewport (ignored after mount). */
  initialRegion?: MapRegion;
  /**
   * Focus region: whenever this value changes the map animates to it. To move back to the same
   * region after the user panned, call `ref.current.animateToRegion(region)` instead.
   */
  region?: MapRegion;
  markers?: readonly AppMapMarker[];
  circles?: readonly AppMapCircle[];
  onMarkerPress?: (id: string) => void;
  /** Tap on an empty spot of the map (not fired for taps on markers or the pin). */
  onPress?: (coordinate: GeoCoordinates) => void;
  /** The camera settled after the user or an animation moved it. */
  onRegionChange?: (region: MapRegion) => void;
  /** A draggable location pin (location picker). */
  draggablePin?: AppMapDraggablePin;
  /** Zoom buttons in the top end corner (default `false`). */
  showZoomControls?: boolean;
  /**
   * `false` renders a static preview: no gestures, taps, zoom buttons or keyboard focus, and
   * touches reach the screen behind (e.g. a scrolling list). Default `true`.
   */
  interactive?: boolean;
  /** Overlays covering the map's edges (see `AppMapInsets`). */
  controlInsets?: AppMapInsets;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** Imperative camera API (`animateToRegion`). */
  ref?: Ref<AppMapHandle>;
}
