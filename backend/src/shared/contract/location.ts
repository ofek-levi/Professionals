import type { EntityId } from './common.js';

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

export interface ServiceLocation {
  coordinates: GeoCoordinates;
  /** Empty when redacted for privacy. */
  addressLine: string;
  city: string;
  neighborhood: string | null;
  details: string | null;
  isApproximate: boolean;
}

export interface ServiceArea {
  center: GeoCoordinates;
  radiusKm: number;
  label: string;
}

export interface SavedLocation {
  id: EntityId;
  label: string;
  location: ServiceLocation;
}

export interface PlaceSuggestion {
  id: EntityId;
  addressLine: string;
  city: string;
  neighborhood: string | null;
  coordinates: GeoCoordinates;
}
