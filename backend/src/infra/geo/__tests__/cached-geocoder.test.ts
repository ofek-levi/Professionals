import { describe, expect, it } from 'vitest';

import { createTestDeps } from '../../../../test/app.js';
import { CachedGeocoder } from '../cached-geocoder.js';
import { MemoryGeocoder } from '../memory-geocoder.js';

describe('CachedGeocoder', () => {
  const deps = createTestDeps();

  it('caches search and reverse results (normalized query, per language)', async () => {
    const provider = new MemoryGeocoder();
    const geocoder = new CachedGeocoder(provider, { cache: deps.cache, redis: deps.redis, keys: deps.keys, minIntervalMs: 0 });

    const results = await geocoder.search('Dizengoff', { limit: 5, language: 'en' });
    expect(results.map((place) => place.addressLine)).toEqual(['Dizengoff St 120']);
    expect(await geocoder.search('  dizengoff ', { limit: 5, language: 'en' })).toEqual(results);
    expect(provider.calls).toBe(1);
    await geocoder.search('dizengoff', { limit: 5, language: 'he' });
    expect(provider.calls).toBe(2);

    const sea = { latitude: 32.1, longitude: 34.5 };
    expect(await geocoder.reverse(sea, { language: 'en' })).toBeNull();
    expect(await geocoder.reverse(sea, { language: 'en' })).toBeNull();
    expect(provider.calls).toBe(3);
  });

  it('spaces provider calls by the global gate', async () => {
    const provider = new MemoryGeocoder();
    const geocoder = new CachedGeocoder(provider, { cache: deps.cache, redis: deps.redis, keys: deps.keys, minIntervalMs: 300 });
    const started = Date.now();
    await Promise.all([
      geocoder.search('rothschild', { limit: 5, language: 'en' }),
      geocoder.search('bialik', { limit: 5, language: 'en' }),
    ]);
    expect(provider.calls).toBe(2);
    expect(Date.now() - started).toBeGreaterThanOrEqual(250);
  });
});
