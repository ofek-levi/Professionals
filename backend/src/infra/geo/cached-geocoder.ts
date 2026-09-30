/**
 * Caches geocoder answers in Redis and gates provider calls to one per `minIntervalMs` across all
 * instances (Nominatim's policy is ≤ 1 request/s). The routes are public (sign-up), so:
 * - every cache miss is charged to the caller's budget (`GeocodeCaller.chargeMiss`), and anonymous
 *   misses also pass a second gate at twice the interval: strangers can use at most half of the
 *   provider's rate, and signed-in users (request creation) always keep the other half;
 * - the TTLs bound the keyspace (new keys ≤ one per provider call, itself ≤ 1/s):
 *   reverse lookups (points rounded to ~11 m) 30 days; search answers 7 days, one entry per query
 *   whatever the `limit` (the provider is asked for `maxResults`, the answer sliced); empty answers
 *   (typos, half-typed words) 1 day.
 */
import { ApiError } from '../../lib/errors.js';
import type { Cache } from '../cache.js';
import { KEY_SPACES, type RedisKeys } from '../keys.js';
import type { Redis } from '../redis.js';
import type { GeoCoordinates, PlaceSuggestion } from '../../shared/contract/index.js';
import { API_LIMITS } from '../../shared/limits.js';
import type { GeocodeCaller, GeocodeOptions, Geocoder } from './geocoder.js';

const DAY_SECONDS = 24 * 60 * 60;
const REVERSE_TTL_SECONDS = API_LIMITS.geocoderCacheTtlDays * DAY_SECONDS;
const SEARCH_TTL_SECONDS = 7 * DAY_SECONDS;
const EMPTY_TTL_SECONDS = DAY_SECONDS;
/** How long a request may wait for its turn at the gate before giving up. */
const MAX_WAIT_MS = 4000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface CachedGeocoderOptions {
  cache: Cache;
  redis: Redis;
  keys: RedisKeys;
  /** 1000 in production; 0 disables the gate (tests). */
  minIntervalMs: number;
  /** Results fetched and cached per search query (the largest `limit` served). */
  maxResults: number;
}

export class CachedGeocoder implements Geocoder {
  constructor(
    private readonly inner: Geocoder,
    private readonly options: CachedGeocoderOptions,
  ) {}

  /** Waits until this instance holds `gate` (`SET NX PX intervalMs`), or gives up with 429. */
  private async acquire(gate: string, intervalMs: number, deadline: number): Promise<void> {
    const { redis } = this.options;
    for (;;) {
      if ((await redis.set(gate, '1', 'PX', intervalMs, 'NX')) === 'OK') return;
      const wait = Math.max(await redis.pttl(gate), 10) + Math.floor(Math.random() * 25);
      if (Date.now() + wait > deadline) throw ApiError.rateLimited('Address search is busy, please try again');
      await sleep(wait);
    }
  }

  /** Charges the miss to the caller, then takes the provider slot (anonymous: its own lane first). */
  private async beforeProviderCall(caller: GeocodeCaller | undefined): Promise<void> {
    await caller?.chargeMiss();
    const { keys, minIntervalMs } = this.options;
    if (minIntervalMs <= 0) return;
    const deadline = Date.now() + MAX_WAIT_MS;
    if (caller?.anonymous) await this.acquire(keys.key(KEY_SPACES.geocoderGate, 'anonymous'), 2 * minIntervalMs, deadline);
    await this.acquire(keys.key(KEY_SPACES.geocoderGate), minIntervalMs, deadline);
  }

  async search(query: string, options: GeocodeOptions & { limit: number }): Promise<PlaceSuggestion[]> {
    const normalized = query.trim().toLowerCase().replace(/\s+/g, ' ');
    const key = `geo:search:${options.language}:${normalized}`;
    const cached = await this.options.cache.get<PlaceSuggestion[]>(key);
    if (cached) return cached.slice(0, options.limit);
    await this.beforeProviderCall(options.caller);
    const result = await this.inner.search(normalized, { language: options.language, limit: this.options.maxResults });
    await this.options.cache.set(key, result, result.length > 0 ? SEARCH_TTL_SECONDS : EMPTY_TTL_SECONDS);
    return result.slice(0, options.limit);
  }

  async reverse(coordinates: GeoCoordinates, options: GeocodeOptions): Promise<PlaceSuggestion | null> {
    // ~11 m (4 decimals): taps around one spot share an entry, and the address is looked up for the
    // rounded point so the cached answer is the same for all of them.
    const rounded = { latitude: Number(coordinates.latitude.toFixed(4)), longitude: Number(coordinates.longitude.toFixed(4)) };
    const key = `geo:reverse:${options.language}:${rounded.latitude.toFixed(4)}:${rounded.longitude.toFixed(4)}`;
    const cached = await this.options.cache.get<{ place: PlaceSuggestion | null }>(key);
    if (cached) return cached.place;
    await this.beforeProviderCall(options.caller);
    const place = await this.inner.reverse(rounded, { language: options.language });
    await this.options.cache.set(key, { place }, place ? REVERSE_TTL_SECONDS : EMPTY_TTL_SECONDS);
    return place;
  }
}
