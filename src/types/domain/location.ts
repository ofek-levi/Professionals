import type { EntityId } from './common';

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

/** A concrete, addressable place where a service is performed. */
export interface ServiceLocation {
  coordinates: GeoCoordinates;
  /** Street + house number, e.g. "Dizengoff St 120". Empty when redacted for privacy. */
  addressLine: string;
  city: string;
  neighborhood: string | null;
  /** Apartment, floor, entry code, parking hints… */
  details: string | null;
  /**
   * `true` when the backend deliberately returned an approximate location
   * (e.g. to professionals that were not selected for the job).
   */
  isApproximate: boolean;
}

/** Geographic area a professional is willing to travel to. */
export interface ServiceArea {
  center: GeoCoordinates;
  radiusKm: number;
  /** Human readable name of the base location, e.g. "Tel Aviv-Yafo". */
  label: string;
}

export interface SavedLocation {
  id: EntityId;
  label: string;
  location: ServiceLocation;
}

/** Result item of the (mock) geocoding / place search API. */
export interface PlaceSuggestion {
  id: EntityId;
  addressLine: string;
  city: string;
  neighborhood: string | null;
  coordinates: GeoCoordinates;
}
