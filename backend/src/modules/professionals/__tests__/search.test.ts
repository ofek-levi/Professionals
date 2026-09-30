import request from 'supertest';
import type { Express } from 'express';
import { beforeAll, describe, expect, it } from 'vitest';

import { clearDatabase, createTestApp } from '../../../../test/app.js';
import { signInCustomer } from '../../../../test/auth.js';
import { HAIFA, RAMAT_GAN, TEL_AVIV, createProfessional } from '../../../../test/factories.js';
import { fromGeoPoint, haversineDistanceKm, offsetCoordinates } from '../../../lib/geo.js';
import type { CategoryId } from '../../../shared/catalog/index.js';
import type { GeoCoordinates } from '../../../shared/contract/index.js';
import { bayesianRating, emptyRatingCounts } from '../professional-rank.js';

function stats(averageRating: number | null, reviewCount: number) {
  return {
    averageRating,
    reviewCount,
    completedJobsCount: reviewCount,
    responseTimeMinutes: null,
    ratingCounts: emptyRatingCounts(), // not read by search
    rankScore: bayesianRating(averageRating, reviewCount),
  };
}

async function pro(name: string, categoryIds: CategoryId[], rating: [number | null, number], center: GeoCoordinates, radiusKm: number) {
  const { professional } = await createProfessional({ professional: { displayName: name, categoryIds, stats: stats(...rating) }, center, radiusKm });
  return professional;
}

/** Walks every page and returns the display names in order. */
async function allPages(app: Express, headers: Record<string, string>, query: Record<string, string | number>): Promise<string[]> {
  const names: string[] = [];
  let cursor: string | null = null;
  do {
    const res = await request(app)
      .get('/v1/professionals')
      .set(headers)
      .query({ ...query, ...(cursor ? { cursor } : {}) })
      .expect(200);
    const body = res.body as { items: { displayName: string }[]; nextCursor: string | null };
    names.push(...body.items.map((item) => item.displayName));
    cursor = body.nextCursor;
  } while (cursor);
  return names;
}

describe('GET /v1/professionals', () => {
  const { app, deps } = createTestApp();
  let headers: Record<string, string>;

  beforeAll(async () => {
    await clearDatabase();
    headers = (await signInCustomer(deps)).headers;
    await pro('Top', ['plumbing'], [4.9, 20], TEL_AVIV, 20);
    await pro('Haifa', ['plumbing'], [null, 0], HAIFA, 10);
    await pro('Electric', ['electrical'], [4.5, 2], TEL_AVIV, 20);
    await pro('RamatGan', ['plumbing'], [null, 0], RAMAT_GAN, 5);
    await pro('Steady', ['plumbing', 'handyman'], [4.2, 5], TEL_AVIV, 20);
    await pro('Center', ['plumbing'], [null, 0], TEL_AVIV, 10);
  });

  it('ranks by Bayesian rating, then review count, then id', async () => {
    const res = await request(app).get('/v1/professionals').set(headers).expect(200);
    expect(res.body.totalCount).toBe(6);
    expect(res.body.nextCursor).toBeNull();
    expect(res.body.items.map((item: { displayName: string }) => item.displayName)).toEqual(['Top', 'Electric', 'Steady', 'Haifa', 'RamatGan', 'Center']);
    expect(res.body.items[0]).toEqual({
      id: expect.any(String),
      displayName: 'Top',
      avatarUrl: null,
      headline: 'Fast and tidy',
      categoryIds: ['plumbing'],
      yearsOfExperience: 8,
      averageRating: 4.9,
      reviewCount: 20,
      completedJobsCount: 20,
      isVerified: false,
      city: 'Tel Aviv-Yafo',
    });
  });

  it('pages with stable keyset cursors', async () => {
    expect(await allPages(app, headers, { limit: 2 })).toEqual(['Top', 'Electric', 'Steady', 'Haifa', 'RamatGan', 'Center']);
    const first = await request(app).get('/v1/professionals').set(headers).query({ limit: 2, categoryId: 'plumbing' }).expect(200);
    expect(first.body).toMatchObject({ totalCount: 5, nextCursor: expect.any(String) });
    expect(await allPages(app, headers, { limit: 2, categoryId: 'plumbing' })).toEqual(['Top', 'Steady', 'Haifa', 'RamatGan', 'Center']);
  });

  it('keeps only professionals whose service area covers the point, nearer first among equals', async () => {
    const near = { lat: TEL_AVIV.latitude, lng: TEL_AVIV.longitude };
    const res = await request(app).get('/v1/professionals').set(headers).query({ ...near, categoryId: 'plumbing' }).expect(200);
    expect(res.body.totalCount).toBe(4);
    expect(res.body.items.map((item: { displayName: string }) => item.displayName)).toEqual(['Top', 'Steady', 'Center', 'RamatGan']);
    expect(await allPages(app, headers, { ...near, categoryId: 'plumbing', limit: 1 })).toEqual(['Top', 'Steady', 'Center', 'RamatGan']);
    expect(await allPages(app, headers, { lat: HAIFA.latitude, lng: HAIFA.longitude })).toEqual(['Haifa']);
    // One coordinate alone is ignored (as in the app's reference backend).
    expect((await request(app).get('/v1/professionals').set(headers).query({ lat: 32 }).expect(200)).body.totalCount).toBe(6);
  });

  it('never measures from the hidden base address: coverage, order and cursors use the public center', async () => {
    const { professional } = await createProfessional({ professional: { displayName: 'Hidden', categoryIds: ['painting'] }, center: TEL_AVIV, radiusKm: 5 });
    const exact = fromGeoPoint(professional.serviceArea.center);
    const shown = fromGeoPoint(professional.serviceArea.publicCenter);
    expect(haversineDistanceKm(exact, shown)).toBeGreaterThan(0.24);
    // Points around the circles' edges where the exact and the public circle disagree.
    const around = Array.from({ length: 72 }, (_, i) => offsetCoordinates(shown, 5_100, i * 5));
    const insideExactOnly = around.find((point) => haversineDistanceKm(exact, point) < 4.9);
    const edge = Array.from({ length: 72 }, (_, i) => offsetCoordinates(shown, 4_900, i * 5));
    const insidePublicOnly = edge.find((point) => haversineDistanceKm(exact, point) > 5.1);
    if (!insideExactOnly || !insidePublicOnly) throw new Error('no disagreeing point found');

    const search = (point: GeoCoordinates) =>
      request(app).get('/v1/professionals').set(headers).query({ lat: point.latitude, lng: point.longitude, categoryId: 'painting' }).expect(200);
    expect((await search(insideExactOnly)).body.totalCount).toBe(0);
    expect((await search(insidePublicOnly)).body.totalCount).toBe(1);
  });

  it('puts only 0.1 km distances into cursors', async () => {
    const off = offsetCoordinates(TEL_AVIV, 1_234, 77);
    const first = await request(app).get('/v1/professionals').set(headers).query({ lat: off.latitude, lng: off.longitude, limit: 1 }).expect(200);
    const cursor = JSON.parse(Buffer.from(String(first.body.nextCursor), 'base64url').toString('utf8')) as { k: unknown[] };
    const distance = cursor.k[2];
    expect(typeof distance).toBe('number');
    expect(Math.abs(Number(distance) * 10 - Math.round(Number(distance) * 10))).toBeLessThan(1e-9);
  });

  it('validates the query', async () => {
    const badCategory = await request(app).get('/v1/professionals').set(headers).query({ categoryId: 'astrology' }).expect(400);
    expect(badCategory.body.fieldErrors).toEqual({ categoryId: ['validation:invalid'] });
    const badPoint = await request(app).get('/v1/professionals').set(headers).query({ lat: 99, lng: 34 }).expect(400);
    expect(badPoint.body.fieldErrors).toEqual({ lat: ['validation:location.coordinatesInvalid'] });
    const badCursor = await request(app).get('/v1/professionals').set(headers).query({ cursor: 'garbage' }).expect(400);
    expect(badCursor.body.fieldErrors).toEqual({ cursor: ['validation:invalid'] });
    await request(app).get('/v1/professionals').expect(401);
  });
});
