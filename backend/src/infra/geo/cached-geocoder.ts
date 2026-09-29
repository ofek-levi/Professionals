/**
 * Caches geocoder answers in Redis (30 days: addresses rarely move) and gates provider calls to
 * one per `minIntervalMs` across all instances (Nominatim's policy is ≤ 1 request/s).
 */
import { ApiError } from '../../lib/errors.js';
import type { Cache } from '../cache.js';
import { KEY_SPACES, type RedisKeys } from '../keys.js';
import type { Redis } from '../redis.js';
import type { AppLanguage } from '../../shared/domain.js';
import type { GeoCoordinates, PlaceSuggestion } from '../../shared/contract/index.js';
import { API_LIMITS } from '../../shared/limits.js';
import type { Geocoder } from './geocoder.js';

const TTL_SECONDS = API_LIMITS.geocoderCacheTtlDays * 24 * 60 * 60;
/** How long a request may wait for its turn at the gate before giving up. */
const MAX_WAIT_MS = 4000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface CachedGeocoderOptions {
  cache: Cache;
  redis: Redis;
  keys: RedisKeys;
  /** 1000 in production; 0 disables the gate (tests). */
  minIntervalMs: number;
}

export class CachedGeocoder implements Geocoder {
  constructor(
    private readonly inner: Geocoder,
    private readonly options: CachedGeocoderOptions,
  ) {}

  /** Waits until this instance holds the global provider slot (`SET NX PX`). */
  private async acquireSlot(): Promise<void> {
    const { redis, keys, minIntervalMs } = this.options;
    if (minIntervalMs <= 0) return;
    const gate = keys.key(KEY_SPACES.geocoderGate);
    const deadline = Date.now() + MAX_WAIT_MS;
    for (;;) {
      if ((await redis.set(gate, '1', 'PX', minIntervalMs, 'NX')) === 'OK') return;
      const wait = Math.max(await redis.pttl(gate), 10) + Math.floor(Math.random() * 25);
      if (Date.now() + wait > deadline) throw ApiError.rateLimited('Address search is busy, please try again');
      await sleep(wait);
    }
  }

  async search(query: string, options: { limit: number; language: AppLanguage }): Promise<PlaceSuggestion[]> {
    const normalized = query.trim().toLowerCase().replace(/\s+/g, ' ');
    const key = `geo:search:${options.language}:${options.limit}:${normalized}`;
    const cached = await this.options.cache.get<PlaceSuggestion[]>(key);
    if (cached) return cached;
    await this.acquireSlot();
    const result = await this.inner.search(normalized, options);
    await this.options.cache.set(key, result, TTL_SECONDS);
    return result;
  }

  async reverse(coordinates: GeoCoordinates, options: { language: AppLanguage }): Promise<PlaceSuggestion | null> {
    // ~1 m precision: nearby taps share one cache entry.
    const key = `geo:reverse:${options.language}:${coordinates.latitude.toFixed(5)}:${coordinates.longitude.toFixed(5)}`;
    const cached = await this.options.cache.get<{ place: PlaceSuggestion | null }>(key);
    if (cached) return cached.place;
    await this.acquireSlot();
    const place = await this.inner.reverse(coordinates, options);
    await this.options.cache.set(key, { place }, TTL_SECONDS);
    return place;
  }
}
