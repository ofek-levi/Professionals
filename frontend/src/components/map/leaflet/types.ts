import type { Ref } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import type { GeoCoordinates } from '@/types/domain';
import type { MapRegion } from '@/utils/geo';

import type { MapPageState } from './map-protocol';

/** `loading` until the page reports `ready`; `error` when it failed to start (or never answered). */
export type MapStatus = 'loading' | 'ready' | 'error';

/** Camera commands (queued until the page is ready). */
export interface LeafletMapHandle {
  animateToRegion: (region: MapRegion, durationMs: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

export interface LeafletMapEvents {
  onMarkerPress?: (id: string) => void;
  /** Tap on an empty spot (never fired for a tap on a marker or the pin). */
  onMapPress?: (coordinate: GeoCoordinates) => void;
  onPinDragEnd?: (coordinate: GeoCoordinates) => void;
  /** The camera settled after a gesture or an animation. */
  onRegionChange?: (region: MapRegion) => void;
  onStatusChange?: (status: MapStatus) => void;
}

/**
 * Platform host of the Leaflet page (`leaflet-map.tsx`: react-native-webview, `leaflet-map.web.tsx`:
 * sandboxed iframe). Hosts only move data: `AppMap` builds the page state.
 */
export interface LeafletMapProps extends LeafletMapEvents {
  /** Full declarative page state; sent to the page whenever its content changes. */
  state: MapPageState;
  /** Camera when the page (re)loads before the user moved it. */
  initialRegion: MapRegion;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  ref?: Ref<LeafletMapHandle>;
}
