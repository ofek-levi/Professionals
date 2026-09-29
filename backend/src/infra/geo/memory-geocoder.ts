import { haversineDistanceKm } from '../../lib/geo.js';
import type { GeoCoordinates, PlaceSuggestion } from '../../shared/contract/index.js';
import type { Geocoder } from './geocoder.js';

/** A few Tel Aviv places; enough for sign-up and request tests. */
export const TEST_PLACES: PlaceSuggestion[] = [
  { id: 'n1', addressLine: 'Dizengoff St 120', city: 'Tel Aviv-Yafo', neighborhood: 'Old North', coordinates: { latitude: 32.0853, longitude: 34.7818 } },
  { id: 'n2', addressLine: 'Rothschild Blvd 1', city: 'Tel Aviv-Yafo', neighborhood: 'Lev HaIr', coordinates: { latitude: 32.0626, longitude: 34.7707 } },
  { id: 'n3', addressLine: 'Bialik St 10', city: 'Ramat Gan', neighborhood: null, coordinates: { latitude: 32.0823, longitude: 34.8131 } },
];

/** In-memory geocoder for tests; `calls` counts provider hits (to assert caching). */
export class MemoryGeocoder implements Geocoder {
  calls = 0;

  constructor(private readonly places: PlaceSuggestion[] = TEST_PLACES) {}

  search(query: string, options: { limit: number }): Promise<PlaceSuggestion[]> {
    this.calls += 1;
    const needle = query.trim().toLowerCase();
    return Promise.resolve(
      this.places
        .filter((place) => `${place.addressLine} ${place.city}`.toLowerCase().includes(needle))
        .slice(0, options.limit),
    );
  }

  reverse(coordinates: GeoCoordinates): Promise<PlaceSuggestion | null> {
    this.calls += 1;
    const nearest = [...this.places].sort(
      (a, b) => haversineDistanceKm(a.coordinates, coordinates) - haversineDistanceKm(b.coordinates, coordinates),
    )[0];
    return Promise.resolve(nearest && haversineDistanceKm(nearest.coordinates, coordinates) < 5 ? nearest : null);
  }
}
