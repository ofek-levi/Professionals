/**
 * Mock geocoding over the Tel Aviv metro gazetteer: bilingual (English/Hebrew) place search and
 * reverse geocoding to the nearest known street.
 */
import { DomainError } from '@/features/shared/domain-error';
import { hashString } from '@/features/shared/seeded-random';
import type { AppLanguage, GeoCoordinates, PlaceSuggestion, ServiceLocation } from '@/types/domain';
import { haversineDistanceKm, offsetCoordinates } from '@/utils/geo';

import { getPlace, PLACES, type GazetteerPlace } from '../../data/places';

const HEBREW_LETTERS = /[א-ת]/;
const LATIN_LETTERS = /[a-z]/i;
const STOP_WORDS = new Set(['st', 'street', 'rd', 'road', 'blvd', 'boulevard', 'ave', 'avenue', 'רחוב', 'רח', 'שד', 'שדרות', 'דרך']);

const DEFAULT_SEARCH_LIMIT = 8;
const MAX_SEARCH_LIMIT = 20;

/** Lowercases, strips niqqud, quotes and punctuation, collapses whitespace. */
function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[֑-ׇ]/g, '')
    .replace(/["'’`״׳.,\-()/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Language of the query script, falling back to `fallback` (e.g. the Accept-Language). */
function detectQueryLanguage(query: string, fallback: AppLanguage): AppLanguage {
  if (HEBREW_LETTERS.test(query)) return 'he';
  if (LATIN_LETTERS.test(query)) return 'en';
  return fallback;
}

/** Deterministic point on a street, a few hundred meters from the place center. */
export function streetCoordinates(place: GazetteerPlace, streetIndex: number, houseNumber: number | null = null): GeoCoordinates {
  const bearing = (hashString(place.id) + streetIndex * 137) % 360;
  const base = offsetCoordinates(place.center, 90 + streetIndex * 110, bearing);
  if (!houseNumber) return base;
  return offsetCoordinates(base, (houseNumber % 60) * 4, (bearing + 90) % 360);
}

function addressLine(place: GazetteerPlace, streetIndex: number, houseNumber: number | null, language: AppLanguage): string {
  const name = place.streets[streetIndex].name[language];
  return houseNumber ? `${name} ${houseNumber}` : name;
}

function toPlaceSuggestion(
  place: GazetteerPlace,
  streetIndex: number,
  houseNumber: number | null,
  language: AppLanguage,
  coordinates: GeoCoordinates = streetCoordinates(place, streetIndex, houseNumber),
): PlaceSuggestion {
  return {
    id: `${place.id}:${streetIndex}:${houseNumber ?? 0}`,
    addressLine: addressLine(place, streetIndex, houseNumber, language),
    city: place.city[language],
    neighborhood: place.neighborhood?.[language] ?? null,
    coordinates,
  };
}

interface Candidate {
  place: GazetteerPlace;
  streetIndex: number;
  score: number;
}

function scoreCandidate(place: GazetteerPlace, streetIndex: number, tokens: string[]): number {
  const fields: { words: string[]; weight: number }[] = [
    { words: [], weight: 3 },
    { words: [], weight: 2 },
    { words: [], weight: 1 },
  ];
  for (const language of ['en', 'he'] as const) {
    fields[0].words.push(...normalizeSearchText(place.streets[streetIndex].name[language]).split(' '));
    if (place.neighborhood) fields[1].words.push(...normalizeSearchText(place.neighborhood[language]).split(' '));
    fields[2].words.push(...normalizeSearchText(place.city[language]).split(' '));
  }
  let score = 0;
  for (const token of tokens) {
    let best = 0;
    for (const field of fields) {
      for (const word of field.words) {
        if (word === token) best = Math.max(best, field.weight + 1);
        else if (word.startsWith(token)) best = Math.max(best, field.weight);
      }
    }
    if (best === 0) return 0;
    score += best;
  }
  return score;
}

const collators = new Map<AppLanguage, Intl.Collator>();

/**
 * One collator per language, reused: many candidates tie on score, and `localeCompare` would build a
 * new platform collator for every comparison on Hermes (a JNI round-trip each on Android).
 */
function getCollator(language: AppLanguage): Intl.Collator {
  let collator = collators.get(language);
  if (!collator) {
    collator = new Intl.Collator(language);
    collators.set(language, collator);
  }
  return collator;
}

/** `GET /geo/search?q=` – street-level suggestions; a house number in the query is kept. */
export function searchPlaces(query: string, options: { limit?: number; language: AppLanguage }): PlaceSuggestion[] {
  const normalized = normalizeSearchText(query);
  if (!normalized) return [];
  const words = normalized.split(' ');
  const numberToken = words.find((word) => /^\d{1,4}$/.test(word));
  const houseNumber = numberToken ? Number(numberToken) : null;
  const tokens = words.filter((word) => word !== numberToken && !STOP_WORDS.has(word));
  if (tokens.length === 0) return [];
  const language = detectQueryLanguage(query, options.language);
  const limit = Math.min(Math.max(1, options.limit ?? DEFAULT_SEARCH_LIMIT), MAX_SEARCH_LIMIT);

  const candidates: Candidate[] = [];
  for (const place of PLACES) {
    for (let streetIndex = 0; streetIndex < place.streets.length; streetIndex += 1) {
      const score = scoreCandidate(place, streetIndex, tokens);
      if (score > 0) candidates.push({ place, streetIndex, score });
    }
  }
  const collator = getCollator(language);
  return candidates
    .sort(
      (a, b) =>
        b.score - a.score ||
        collator.compare(a.place.city[language], b.place.city[language]) ||
        collator.compare(a.place.streets[a.streetIndex].name[language], b.place.streets[b.streetIndex].name[language]),
    )
    .slice(0, limit)
    .map(({ place, streetIndex }) => toPlaceSuggestion(place, streetIndex, houseNumber, language));
}

/** `GET /geo/reverse` – nearest known street; the returned coordinates are the requested point. */
/** Farther than this from every street of the gazetteer there is "no address" (the sea, open land). */
const MAX_REVERSE_DISTANCE_KM = 5;

/** The nearest street of the gazetteer; 404 where there is none (like the backend's geocoder). */
export function reverseGeocode(coordinates: GeoCoordinates, language: AppLanguage): PlaceSuggestion {
  let nearest = { place: PLACES[0], streetIndex: 0, distance: Infinity };
  for (const place of PLACES) {
    for (let streetIndex = 0; streetIndex < place.streets.length; streetIndex += 1) {
      const distance = haversineDistanceKm(coordinates, streetCoordinates(place, streetIndex));
      if (distance < nearest.distance) nearest = { place, streetIndex, distance };
    }
  }
  if (nearest.distance > MAX_REVERSE_DISTANCE_KM) throw DomainError.notFound('Address');
  return toPlaceSuggestion(nearest.place, nearest.streetIndex, null, language, {
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
  });
}

/** Builds a full English service location from the gazetteer (used by the seed data). */
export function locationFromPlace(
  placeId: string,
  streetIndex: number,
  houseNumber: number,
  details: string | null = null,
): ServiceLocation {
  const place = getPlace(placeId);
  const suggestion = toPlaceSuggestion(place, streetIndex, houseNumber, 'en');
  return {
    coordinates: suggestion.coordinates,
    addressLine: suggestion.addressLine,
    city: suggestion.city,
    neighborhood: suggestion.neighborhood,
    details,
    isApproximate: false,
  };
}
