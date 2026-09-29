/** Address autocomplete and reverse geocoding through `deps.geocoder` (cached, rate gated). */
import type { AppDeps } from '../../deps.js';
import { ApiError } from '../../lib/errors.js';
import type { GeoCoordinates, PlaceSuggestion } from '../../shared/contract/index.js';
import type { AppLanguage } from '../../shared/domain.js';
import { GEO_SEARCH, type SearchPlacesInput } from './geo.schemas.js';

const HEBREW_LETTERS = /[א-ת]/;
const LATIN_LETTERS = /[a-z]/i;

/** Results follow the script of the query (Hebrew → Hebrew names), else the caller's language. */
export function queryLanguage(query: string, fallback: AppLanguage): AppLanguage {
  if (HEBREW_LETTERS.test(query)) return 'he';
  if (LATIN_LETTERS.test(query)) return 'en';
  return fallback;
}

export async function searchPlaces(
  deps: Pick<AppDeps, 'geocoder'>,
  input: SearchPlacesInput,
  language: AppLanguage,
): Promise<PlaceSuggestion[]> {
  const query = input.q.replace(/\s+/g, ' ').trim();
  if (query.length < GEO_SEARCH.minQueryLength) return [];
  return deps.geocoder.search(query, { limit: input.limit, language: queryLanguage(query, language) });
}

/**
 * Nearest address; the answer keeps the requested point (the pin the user placed) rather than the
 * address's own coordinates, like the app's reference backend.
 */
export async function reverseGeocode(
  deps: Pick<AppDeps, 'geocoder'>,
  coordinates: GeoCoordinates,
  language: AppLanguage,
): Promise<PlaceSuggestion> {
  const place = await deps.geocoder.reverse(coordinates, { language });
  if (!place) throw ApiError.notFound('Address');
  return { ...place, coordinates: { latitude: coordinates.latitude, longitude: coordinates.longitude } };
}
