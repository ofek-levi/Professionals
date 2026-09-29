import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createTestApp } from '../../../../test/app.js';
import { CATEGORY_CATALOG, CATEGORY_IDS } from '../../../shared/catalog/index.js';

describe('GET /v1/catalog/categories', () => {
  const { app } = createTestApp();

  it('serves the catalog with caching headers and no session', async () => {
    const res = await request(app).get('/v1/catalog/categories').expect(200);

    expect(res.body.version).toBe(CATEGORY_CATALOG.version);
    expect(res.body.groups).toHaveLength(4);
    expect(res.body.categories.map((category: { id: string }) => category.id)).toEqual([...CATEGORY_IDS]);
    expect(res.body.categories[0]).toMatchObject({ id: 'plumbing', groupId: 'home_repairs', sortOrder: 1, isPopular: true });
    expect(res.headers['cache-control']).toBe('public, max-age=3600, stale-while-revalidate=86400');
    expect(res.headers.etag).toMatch(/^"2026\.09\.1-.+"$/);
  });

  it('answers 304 when the client already has this version', async () => {
    const first = await request(app).get('/v1/catalog/categories').expect(200);
    const etag = String(first.headers.etag);

    const res = await request(app).get('/v1/catalog/categories').set('If-None-Match', etag).expect(304);
    expect(res.text).toBe('');
    expect(res.headers.etag).toBe(etag);
  });

  it('serves the full body again for a stale ETag', async () => {
    const res = await request(app).get('/v1/catalog/categories').set('If-None-Match', '"old"').expect(200);
    expect(res.body.categories).toHaveLength(CATEGORY_IDS.length);
  });
});
