/**
 * OpenStreetMap Nominatim client. Usage policy: identify with a User-Agent + email, ≤ 1 request/s
 * (enforced by `CachedGeocoder`), cache results.
 */
import { ApiError } from '../../lib/errors.js';
import type { AppLanguage } from '../../shared/domain.js';
import type { GeoCoordinates, PlaceSuggestion } from '../../shared/contract/index.js';
import type { Geocoder } from './geocoder.js';

interface NominatimPlace {
  osm_type?: string;
  osm_id?: number;
  lat: string;
  lon: string;
  name?: string;
  display_name?: string;
  address?: Record<string, string | undefined>;
}

export interface NominatimConfig {
  url: string;
  userAgent: string;
  email: string | null;
  countryCodes: string;
}

const TIMEOUT_MS = 5000;

function toSuggestion(place: NominatimPlace): PlaceSuggestion | null {
  const latitude = Number(place.lat);
  const longitude = Number(place.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const address = place.address ?? {};
  const street = address.road ?? address.pedestrian ?? address.footway ?? place.name ?? '';
  const number = address.house_number;
  // Hebrew and English both write "<street> <number>" (e.g. "Dizengoff St 120" / "דיזנגוף 120").
  const addressLine = [street, number].filter(Boolean).join(' ') || (place.display_name?.split(',')[0] ?? '');
  const city = address.city ?? address.town ?? address.village ?? address.municipality ?? address.county ?? '';
  const neighborhood = address.suburb ?? address.neighbourhood ?? address.quarter ?? null;
  const id = `${(place.osm_type ?? 'x').charAt(0)}${place.osm_id ?? `${latitude},${longitude}`}`;
  return { id, addressLine, city, neighborhood, coordinates: { latitude, longitude } };
}

export class NominatimGeocoder implements Geocoder {
  constructor(private readonly config: NominatimConfig) {}

  private async get(path: string, params: Record<string, string>, language: AppLanguage): Promise<unknown> {
    const url = new URL(`${this.config.url}/${path}`);
    for (const [key, value] of Object.entries({ format: 'jsonv2', addressdetails: '1', ...params })) url.searchParams.set(key, value);
    if (this.config.email) url.searchParams.set('email', this.config.email);
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { 'User-Agent': this.config.userAgent, 'Accept-Language': language },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw ApiError.unavailable('Address search is temporarily unavailable');
    }
    if (!response.ok) throw ApiError.unavailable('Address search is temporarily unavailable');
    return response.json();
  }

  async search(query: string, options: { limit: number; language: AppLanguage }): Promise<PlaceSuggestion[]> {
    const body = await this.get(
      'search',
      { q: query, limit: String(options.limit), countrycodes: this.config.countryCodes },
      options.language,
    );
    if (!Array.isArray(body)) return [];
    return (body as NominatimPlace[])
      .map(toSuggestion)
      .filter((place): place is PlaceSuggestion => place !== null);
  }

  async reverse(coordinates: GeoCoordinates, options: { language: AppLanguage }): Promise<PlaceSuggestion | null> {
    const body = await this.get(
      'reverse',
      { lat: String(coordinates.latitude), lon: String(coordinates.longitude), zoom: '18' },
      options.language,
    );
    if (!body || typeof body !== 'object' || 'error' in body) return null;
    return toSuggestion(body as NominatimPlace);
  }
}
