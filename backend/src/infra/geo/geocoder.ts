/**
 * Address search and reverse geocoding behind `GET /v1/geo/*`. The production chain is
 * `CachedGeocoder` (Redis cache 30 days + global ≤ 1 req/s gate) → `NominatimGeocoder`.
 */
import type { AppLanguage } from '../../shared/domain.js';
import type { GeoCoordinates, PlaceSuggestion } from '../../shared/contract/index.js';

export interface Geocoder {
  search(query: string, options: { limit: number; language: AppLanguage }): Promise<PlaceSuggestion[]>;
  /** Nearest address, or `null` when there is none (e.g. at sea). */
  reverse(coordinates: GeoCoordinates, options: { language: AppLanguage }): Promise<PlaceSuggestion | null>;
}
