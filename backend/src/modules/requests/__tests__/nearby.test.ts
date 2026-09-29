import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { clearDatabase, createTestApp } from '../../../../test/app.js';
import { signInProfessional, type SignedInProfessional } from '../../../../test/auth.js';
import { createCustomer, createOffer, createRequest, TEL_AVIV, testLocation } from '../../../../test/factories.js';
import { offsetCoordinates } from '../../../lib/geo.js';
import type { UserDoc } from '../../users/user.model.js';
import type { RequestDoc } from '../request.model.js';

const MINUTE = 60_000;

describe('GET /v1/professional/requests/nearby', () => {
  const { app, deps } = createTestApp();
  let pro: SignedInProfessional;
  let customer: UserDoc;
  beforeEach(async () => {
    await clearDatabase();
    pro = await signInProfessional(deps, { radiusKm: 20 });
    customer = await createCustomer();
  });

  /** An open request `km` north of the professional's center, published `minutesAgo` ago. */
  function openRequest(km: number, minutesAgo: number, overrides: Partial<RequestDoc> = {}) {
    return createRequest(customer, {
      location: testLocation(offsetCoordinates(TEL_AVIV, km * 1000, 0)),
      publishedAt: new Date(deps.clock.now().getTime() - minutesAgo * MINUTE),
      ...overrides,
    });
  }

  const ids = (body: { items: { id: string }[] }) => body.items.map((item) => item.id);
  const hex = (doc: { _id: { toHexString(): string } }) => doc._id.toHexString();
  const get = (query = '') => request(app).get(`/v1/professional/requests/nearby${query}`).set(pro.headers).expect(200);

  it('shows open requests of the professional’s categories within the radius, like the app’s rule', async () => {
    const inside = await openRequest(19.98, 1);
    await openRequest(20.02, 2);
    await openRequest(1, 3, { categoryId: 'painting' });
    await openRequest(1, 4, { status: 'professional_selected' });
    await openRequest(1, 5, { status: 'draft', publishedAt: null });
    const received = await openRequest(2, 6, { status: 'offers_received', pendingOfferCount: 1, offerCount: 1 });

    const res = await get();
    expect(ids(res.body)).toEqual([hex(inside), hex(received)]);
    expect(res.body.items[0]).toMatchObject({ distanceKm: 20, isMatch: true, notes: null });
    expect(res.body.totalCount).toBe(2);
  });

  it('applies the explorer filters', async () => {
    const near = await openRequest(2, 1, { urgency: 'emergency' });
    const mid = await openRequest(8, 2, { categoryId: 'handyman', preferredSchedule: { date: '2026-10-05', timeWindow: 'any' } });
    const far = await openRequest(15, 3, { pendingOfferCount: 2, offerCount: 2, status: 'offers_received', preferredSchedule: { date: '2026-10-09', timeWindow: 'any' } });

    expect(ids((await get('?maxDistanceKm=10')).body)).toEqual([hex(near), hex(mid)]);
    expect(ids((await get('?maxDistanceKm=500')).body)).toHaveLength(3);
    expect(ids((await get('?categoryIds=handyman')).body)).toEqual([hex(mid)]);
    expect((await get('?categoryIds=painting')).body).toEqual({ items: [], nextCursor: null, totalCount: 0 });
    expect(ids((await get('?urgencies=emergency,urgent')).body)).toEqual([hex(near)]);
    expect(ids((await get('?offerPresence=has_offers')).body)).toEqual([hex(far)]);
    expect(ids((await get('?offerPresence=no_offers')).body)).toEqual([hex(near), hex(mid)]);
    expect(ids((await get('?preferredDateFrom=2026-10-01&preferredDateTo=2026-10-06')).body)).toEqual([hex(mid)]);
    expect(ids((await get('?preferredDateTo=2026-10-31')).body)).toEqual([hex(mid), hex(far)]);

    await createOffer(near, pro.professional);
    expect(ids((await get('?excludeWithMyOffer=true')).body)).toEqual([hex(mid), hex(far)]);
    const withOffer = (await get()).body.items[0];
    expect(withOffer.myOffer).toMatchObject({ status: 'pending', price: 350 });

    const bad = await request(app).get('/v1/professional/requests/nearby?maxDistanceKm=0&urgencies=x&sort=best&preferredDateFrom=2026-13-01').set(pro.headers).expect(400);
    expect(Object.keys(bad.body.fieldErrors as object).sort()).toEqual(['maxDistanceKm', 'preferredDateFrom', 'sort', 'urgencies.0']);
  });

  it('sorts like the app and pages each order with keyset cursors', async () => {
    const a = await openRequest(5.04, 10, { urgency: 'flexible', pendingOfferCount: 0 });
    const b = await openRequest(5.01, 20, { urgency: 'emergency', pendingOfferCount: 3, status: 'offers_received' });
    const c = await openRequest(1, 30, { urgency: 'urgent', pendingOfferCount: 1, status: 'offers_received' });
    const d = await openRequest(9, 40, { urgency: 'emergency', pendingOfferCount: 0 });
    const expected: Record<string, RequestDoc[]> = {
      newest: [a, b, c, d],
      // 5.04 and 5.01 both show as 5.0 km: newest first among equals.
      nearest: [c, a, b, d],
      most_urgent: [b, d, c, a],
      fewest_offers: [a, d, c, b],
    };
    for (const [sort, order] of Object.entries(expected)) {
      const first = await get(`?sort=${sort}&limit=3`);
      const second = await get(`?sort=${sort}&limit=3&cursor=${first.body.nextCursor as string}`);
      expect([...ids(first.body), ...ids(second.body)], sort).toEqual(order.map(hex));
      expect(second.body.nextCursor).toBeNull();
      expect(first.body.totalCount).toBe(4);
    }
  });

  it('keeps pages stable when requests are published meanwhile', async () => {
    const older = [await openRequest(1, 10), await openRequest(1, 20), await openRequest(1, 30)];
    const first = await get('?limit=2');
    await openRequest(1, 0);
    const second = await get(`?limit=2&cursor=${first.body.nextCursor as string}`);
    expect([...ids(first.body), ...ids(second.body)]).toEqual(older.map(hex));
  });

  it('is for professionals only', async () => {
    const res = await request(app).get('/v1/professional/requests/nearby').set({ Authorization: 'Bearer nope' }).expect(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });
});
