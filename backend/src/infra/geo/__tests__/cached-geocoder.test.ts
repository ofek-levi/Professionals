import { describe, expect, it } from 'vitest';

import { createTestDeps } from '../../../../test/app.js';
import { CachedGeocoder } from '../cached-geocoder.js';
import { MemoryGeocoder } from '../memory-geocoder.js';

describe('CachedGeocoder', () => {
  const deps = createTestDeps();

  it('caches search and reverse results (normalized query, per language)', async () => {
    const provider = new MemoryGeocoder();
    const geocoder = new CachedGeocoder(provider, { cache: deps.cache, redis: deps.redis, keys: deps.keys, minIntervalMs: 0, maxResults: 20 });

    const results = await geocoder.search('Dizengoff', { limit: 5, language: 'en' });
    expect(results.map((place) => place.addressLine)).toEqual(['Dizengoff St 120']);
    expect(await geocoder.search('  dizengoff ', { limit: 5, language: 'en' })).toEqual(results);
    expect(provider.calls).toBe(1);
    await geocoder.search('dizengoff', { limit: 5, language: 'he' });
    expect(provider.calls).toBe(2);
    // One entry per query whatever the limit: the provider is asked for `maxResults`, answers sliced.
    expect(await geocoder.search('tel aviv', { limit: 1, language: 'en' })).toHaveLength(1);
    expect(await geocoder.search('tel aviv', { limit: 5, language: 'en' })).toHaveLength(2);
    expect(provider.calls).toBe(3);

    const sea = { latitude: 32.1, longitude: 34.5 };
    expect(await geocoder.reverse(sea, { language: 'en' })).toBeNull();
    expect(await geocoder.reverse(sea, { language: 'en' })).toBeNull();
    expect(provider.calls).toBe(4);
  });

  it('keeps autocomplete keys short-lived: 7 days per query, 1 day when empty, 30 days for reverse', async () => {
    const geocoder = new CachedGeocoder(new MemoryGeocoder(), { cache: deps.cache, redis: deps.redis, keys: deps.keys, minIntervalMs: 0, maxResults: 20 });
    await geocoder.search('Ramat Gan', { limit: 3, language: 'en' });
    await geocoder.search('qqq', { limit: 3, language: 'en' });
    await geocoder.reverse({ latitude: 32.0853, longitude: 34.7818 }, { language: 'en' });
    const ttlDays = async (pattern: string) => {
      const [key] = await deps.redis.keys(deps.keys.key('cache', pattern));
      return Math.round((await deps.redis.ttl(key ?? '')) / 86_400);
    };
    expect(await ttlDays('geo:search:en:ramat gan')).toBe(7);
    expect(await ttlDays('geo:search:en:qqq')).toBe(1);
    expect(await ttlDays('geo:reverse:en:32.0853:34.7818')).toBe(30);
  });

  it('charges only cache misses to the caller and shares one entry for taps ~11 m apart', async () => {
    const provider = new MemoryGeocoder();
    const geocoder = new CachedGeocoder(provider, { cache: deps.cache, redis: deps.redis, keys: deps.keys, minIntervalMs: 0, maxResults: 20 });
    let charged = 0;
    const caller = { anonymous: true, chargeMiss: () => Promise.resolve(void (charged += 1)) };
    await geocoder.search('allenby', { limit: 5, language: 'en', caller });
    await geocoder.search('Allenby ', { limit: 5, language: 'en', caller });
    await geocoder.reverse({ latitude: 32.07001, longitude: 34.78001 }, { language: 'en', caller });
    await geocoder.reverse({ latitude: 32.07004, longitude: 34.77996 }, { language: 'en', caller });
    expect(charged).toBe(2);
    expect(provider.calls).toBe(2);

    const exhausted = { anonymous: true, chargeMiss: () => Promise.reject(new Error('over budget')) };
    await expect(geocoder.search('hayarkon', { limit: 5, language: 'en', caller: exhausted })).rejects.toThrow('over budget');
    expect(provider.calls).toBe(2);
  });

  it('keeps half of the provider rate for signed-in callers (anonymous lane at twice the interval)', async () => {
    const geocoder = new CachedGeocoder(new MemoryGeocoder(), { cache: deps.cache, redis: deps.redis, keys: deps.keys, minIntervalMs: 200, maxResults: 20 });
    const anonymous = { anonymous: true, chargeMiss: () => Promise.resolve() };
    const started = Date.now();
    await Promise.all(['herzl', 'weizmann', 'arlozorov'].map((q) => geocoder.search(q, { limit: 5, language: 'en', caller: anonymous })));
    expect(Date.now() - started).toBeGreaterThanOrEqual(750);
  });

  it('spaces provider calls by the global gate', async () => {
    const provider = new MemoryGeocoder();
    const geocoder = new CachedGeocoder(provider, { cache: deps.cache, redis: deps.redis, keys: deps.keys, minIntervalMs: 300, maxResults: 20 });
    const started = Date.now();
    await Promise.all([
      geocoder.search('rothschild', { limit: 5, language: 'en' }),
      geocoder.search('bialik', { limit: 5, language: 'en' }),
    ]);
    expect(provider.calls).toBe(2);
    expect(Date.now() - started).toBeGreaterThanOrEqual(250);
  });
});
