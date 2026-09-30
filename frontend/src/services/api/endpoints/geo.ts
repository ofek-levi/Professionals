import type { PlaceSearchParams, ReverseGeocodeParams, WireQueries } from '@/types/api';
import type { PlaceSuggestion } from '@/types/domain';
import type { ApiClient } from '../client';

export function createGeoApi(client: ApiClient) {
  return {
    /** `GET /geo/search` – address / place autocomplete. */
    searchPlaces: (params: PlaceSearchParams, signal?: AbortSignal) =>
      client.get<PlaceSuggestion[]>('/geo/search', { signal, query: { q: params.query, limit: params.limit } satisfies WireQueries['/geo/search'] }),
    /** `GET /geo/reverse` – nearest address for coordinates. */
    reverseGeocode: (params: ReverseGeocodeParams, signal?: AbortSignal) =>
      client.get<PlaceSuggestion>('/geo/reverse', { signal, query: { lat: params.latitude, lng: params.longitude } satisfies WireQueries['/geo/reverse'] }),
  };
}
