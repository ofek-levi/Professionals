/**
 * Address search and reverse geocoding behind `GET /v1/geo/*`. The production chain is
 * `CachedGeocoder` (Redis cache, see its TTLs + global ≤ 1 req/s gate) → `NominatimGeocoder`.
 */
import type { AppLanguage } from '../../shared/domain.js';
import type { GeoCoordinates, PlaceSuggestion } from '../../shared/contract/index.js';

/**
 * Who is asking. Only `CachedGeocoder` reads it: a cache miss costs a provider request, and the
 * provider's rate (≤ 1 request/s for everyone) is the scarce resource, so each caller has a budget
 * of misses, and anonymous callers may use at most half of the provider's rate.
 */
export interface GeocodeCaller {
  /** Charges one cache miss; throws 429 `RATE_LIMITED` when the caller's budget is used up. */
  chargeMiss(): Promise<void>;
  anonymous: boolean;
}

export interface GeocodeOptions {
  language: AppLanguage;
  caller?: GeocodeCaller | undefined;
}

export interface Geocoder {
  search(query: string, options: GeocodeOptions & { limit: number }): Promise<PlaceSuggestion[]>;
  /** Nearest address, or `null` when there is none (e.g. at sea). */
  reverse(coordinates: GeoCoordinates, options: GeocodeOptions): Promise<PlaceSuggestion | null>;
}
