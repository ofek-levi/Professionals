import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestApp } from '../../../../test/app.js';
import { HAIFA } from '../../../../test/factories.js';
import { TEST_PLACES } from '../../../infra/geo/index.js';
import { KEY_SPACES } from '../../../infra/keys.js';
import { queryLanguage } from '../geo.service.js';

async function clearGeoCache(deps: ReturnType<typeof createTestApp>['deps']) {
  const keys = await deps.redis.keys(deps.keys.key(KEY_SPACES.cache, 'geo:*'));
  if (keys.length > 0) await deps.redis.del(...keys);
}

describe('GET /v1/geo/search', () => {
  const { app, deps } = createTestApp();
  beforeEach(async () => {
    await clearGeoCache(deps);
    deps.geocoderProvider.calls = 0;
  });

  it('suggests places without a session, cached and cacheable', async () => {
    const res = await request(app).get('/v1/geo/search').query({ q: '  Dizengoff ', limit: 6 }).expect(200);
    expect(res.body).toEqual([TEST_PLACES[0]]);
    expect(res.headers['cache-control']).toBe('public, max-age=3600');
    expect(res.headers.vary).toContain('Accept-Language');

    await request(app).get('/v1/geo/search').query({ q: 'dizengoff', limit: 6 }).expect(200);
    expect(deps.geocoderProvider.calls).toBe(1);
  });

  it('answers [] for too short queries without calling the provider', async () => {
    for (const q of ['', ' d ', 'x']) {
      const res = await request(app).get('/v1/geo/search').query({ q }).expect(200);
      expect(res.body).toEqual([]);
    }
    await request(app).get('/v1/geo/search').expect(200);
    expect(deps.geocoderProvider.calls).toBe(0);
  });

  it('caps the limit and picks the language from the query script, then Accept-Language', async () => {
    const spy = vi.spyOn(deps.geocoderProvider, 'search');
    await request(app).get('/v1/geo/search').query({ q: 'Bialik', limit: 40 }).set('Accept-Language', 'he-IL').expect(200);
    expect(spy).toHaveBeenLastCalledWith('bialik', { limit: 20, language: 'en' });
    await request(app).get('/v1/geo/search').query({ q: 'ביאליק' }).expect(200);
    expect(spy).toHaveBeenLastCalledWith('ביאליק', { limit: 8, language: 'he' });
    await request(app).get('/v1/geo/search').query({ q: '10 10' }).set('Accept-Language', 'he').expect(200);
    expect(spy).toHaveBeenLastCalledWith('10 10', { limit: 8, language: 'he' });
  });

  it('validates the limit', async () => {
    for (const limit of ['0', '51', '2.5', 'many']) {
      const res = await request(app).get('/v1/geo/search').query({ q: 'Dizengoff', limit }).expect(400);
      expect(res.body).toEqual({ code: 'VALIDATION_ERROR', message: expect.any(String), fieldErrors: { limit: ['validation:invalid'] } });
    }
  });
});

describe('GET /v1/geo/reverse', () => {
  const { app, deps } = createTestApp();
  beforeEach(() => clearGeoCache(deps));

  it('returns the nearest address at the requested point', async () => {
    const res = await request(app).get('/v1/geo/reverse').query({ lat: '32.0627', lng: '34.7708' }).expect(200);
    expect(res.body).toEqual({ ...TEST_PLACES[1], coordinates: { latitude: 32.0627, longitude: 34.7708 } });
    expect(res.headers['cache-control']).toBe('public, max-age=3600');
  });

  it('answers 404 where there is no address', async () => {
    const res = await request(app).get('/v1/geo/reverse').query({ lat: HAIFA.latitude, lng: HAIFA.longitude }).expect(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('flags invalid coordinates on both fields', async () => {
    const invalid = { lat: ['validation:location.coordinatesInvalid'], lng: ['validation:location.coordinatesInvalid'] };
    for (const query of [{}, { lat: '32.1' }, { lat: '91', lng: '34' }, { lat: '32', lng: '181' }, { lat: 'north', lng: '34' }]) {
      const res = await request(app).get('/v1/geo/reverse').query(query).expect(400);
      expect(res.body.fieldErrors).toEqual(invalid);
    }
  });
});

describe('geo rate limit', () => {
  const { app } = createTestApp({ env: { RATE_LIMIT_ENABLED: 'true' } });

  it('limits both routes together per IP', async () => {
    for (let i = 0; i < 30; i += 1) await request(app).get('/v1/geo/search').query({ q: 'x' }).expect(200);
    for (let i = 0; i < 30; i += 1) await request(app).get('/v1/geo/reverse').expect(400);
    const res = await request(app).get('/v1/geo/search').query({ q: 'x' }).expect(429);
    expect(res.body.code).toBe('RATE_LIMITED');
  });
});

describe('queryLanguage', () => {
  it('follows the script, else the fallback', () => {
    expect(queryLanguage('רוטשילד 1', 'en')).toBe('he');
    expect(queryLanguage('Rothschild', 'he')).toBe('en');
    expect(queryLanguage('12', 'he')).toBe('he');
  });
});
