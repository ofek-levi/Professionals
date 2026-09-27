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
  /** Glyph inside the marker (default `map-marker`). */
  icon?: IconSource;
  /** Short text shown under the marker when selected (e.g. category name or price). */
  label?: string;
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

/** Imperative camera control (`const mapRef = useRef<AppMapHandle>(null)`, `<AppMap ref={mapRef} />`). */
export interface AppMapHandle {
  /**
   * Moves the camera to `region`, even when it equals the current `region` prop (e.g. a "recenter"
   * button after the user panned away). `durationMs` applies to native maps; the web canvas jumps.
   */
  animateToRegion: (region: MapRegion, durationMs?: number) => void;
}

/**
 * Cross-platform map contract. `app-map.tsx` implements it with `react-native-maps`,
 * `app-map.web.tsx` with an interactive, dependency-free canvas.
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
  /** Tap on an empty spot of the map. */
  onPress?: (coordinate: GeoCoordinates) => void;
  onRegionChangeComplete?: (region: MapRegion) => void;
  /** A draggable location pin (location picker). */
  draggablePin?: AppMapDraggablePin;
  showsUserLocation?: boolean;
  /** Fit the initial viewport to all markers (+ circles and pin). */
  fitToMarkers?: boolean;
  /** Zoom buttons (always shown on web; optional on native). */
  showZoomControls?: boolean;
  /** Disable panning/zooming (static preview maps). */
  interactive?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** Imperative camera API (`animateToRegion`). */
  ref?: Ref<AppMapHandle>;
}
