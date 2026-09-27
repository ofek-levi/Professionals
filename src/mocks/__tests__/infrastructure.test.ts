import { DomainError } from '@/features/shared/domain-error';

import { PLACES } from '../data/places';
import { DEMO_CUSTOMER_IDS, PRO_IDS, SEED_IDS } from '../data/seed';
import { createMockServer } from '../server';
import { MOCK_DB_SCHEMA_VERSION, type DatabaseSnapshot, type DatabaseStorage } from '../server/db';
import { QueryReader, Router, route } from '../server/router';
import { reverseGeocode, searchPlaces } from '../server/services/geo-service';
import { createTestClock, createTestEnvironment, expectApiError } from '../testing/test-server';

function memoryStorage(initial: DatabaseSnapshot | null = null): DatabaseStorage & { saved: DatabaseSnapshot | null } {
  const storage = {
    saved: initial,
    load: async () => storage.saved,
    save: async (snapshot: DatabaseSnapshot) => {
      storage.saved = JSON.parse(JSON.stringify(snapshot)) as DatabaseSnapshot;
    },
    clear: async () => {
      storage.saved = null;
    },
  };
  return storage;
}

describe('router and query parsing', () => {
  it('parses comma separated lists, numbers and booleans', () => {
    const query = QueryReader.from({ ids: ['a', 'b'], limit: 5, flag: true, empty: '' }, '?extra=1&sort=newest&names=x%2Cy');
    expect(query.list('ids')).toEqual(['a', 'b']);
    expect(query.integer('limit')).toBe(5);
    expect(query.boolean('flag')).toBe(true);
    expect(query.number('extra')).toBe(1);
    expect(query.list('names')).toEqual(['x', 'y']);
    expect(query.string('empty')).toBeUndefined();
    expect(query.enumValue('sort', ['newest', 'nearest'] as const)).toBe('newest');
    expect(() => query.enumValue('sort', ['nearest'] as const)).toThrow(DomainError);
    expect(() => QueryReader.from({ flag: 'maybe' }).boolean('flag')).toThrow(DomainError);
    expect(() => QueryReader.from({ n: 'abc' }).number('n')).toThrow(DomainError);
    expect(() => QueryReader.from({ n: 2.5 }).integer('n')).toThrow(DomainError);
  });

  it('matches methods and path params', () => {
    const router = new Router([
      route({ method: 'GET', path: '/requests/:requestId/offers', auth: 'public', handler: () => 'offers' }),
      route({ method: 'POST', path: '/requests/:requestId/offers', auth: 'public', handler: () => 'create' }),
    ]);
    expect(router.match('GET', '/requests/req%201/offers')?.params).toEqual({ requestId: 'req 1' });
    expect(router.match('POST', '/requests/r/offers')?.route.method).toBe('POST');
    expect(router.match('DELETE', '/requests/r/offers')).toBeNull();
    expect(router.match('GET', '/requests/r')).toBeNull();
  });
});

describe('database', () => {
  it('rolls back failed operations completely', async () => {
    const env = await createTestEnvironment();
    const db = env.server.internals.db;
    const before = db.requests.require(SEED_IDS.requests.noaLeak, 'Request');
    expect(() =>
      env.server.internals.run((ctx) => {
        ctx.db.requests.update(before.id, { status: 'cancelled' });
        ctx.db.offers.update(SEED_IDS.offers.leakAvi, { status: 'rejected' });
        throw DomainError.conflict('boom');
      }),
    ).toThrow('boom');
    expect(db.requests.require(before.id, 'Request')).toBe(before);
    expect(db.offers.require(SEED_IDS.offers.leakAvi, 'Offer').status).toBe('pending');
  });

  it('stores immutable rows', async () => {
    const env = await createTestEnvironment();
    const request = env.server.internals.db.requests.require(SEED_IDS.requests.noaLeak, 'Request');
    expect(Object.isFrozen(request)).toBe(true);
  });

  it('persists to storage, restores it and reseeds on schema changes', async () => {
    const clock = createTestClock();
    const storage = memoryStorage();
    const first = createMockServer({ now: clock.now, persist: true, simulation: false, storage, persistDebounceMs: 5 });
    await first.ready();
    expect(storage.saved?.version).toBe(MOCK_DB_SCHEMA_VERSION);

    await first.handle({
      method: 'POST',
      path: `/requests/${SEED_IDS.requests.noaLeak}/cancel`,
      body: { reason: 'other' },
      headers: { Authorization: `Bearer demo-token:${DEMO_CUSTOMER_IDS.noa}` },
    });
    await first.internals.flushPersistence();

    const second = createMockServer({ now: clock.now, persist: true, simulation: false, storage });
    await second.ready();
    expect(second.internals.db.requests.require(SEED_IDS.requests.noaLeak, 'Request').status).toBe('cancelled');

    const outdated = memoryStorage({ ...(storage.saved as DatabaseSnapshot), version: MOCK_DB_SCHEMA_VERSION - 1 });
    const third = createMockServer({ now: clock.now, persist: true, simulation: false, storage: outdated });
    await third.ready();
    expect(third.internals.db.requests.require(SEED_IDS.requests.noaLeak, 'Request').status).toBe('offers_received');
    expect(outdated.saved?.version).toBe(MOCK_DB_SCHEMA_VERSION);

    await second.reset();
    expect(second.internals.db.requests.require(SEED_IDS.requests.noaLeak, 'Request').status).toBe('offers_received');
    expect(storage.saved?.tables.requests.find((request) => request.id === SEED_IDS.requests.noaLeak)?.status).toBe('offers_received');
  });
});

describe('geo, catalog and profiles', () => {
  it('searches the gazetteer in English and Hebrew', () => {
    const [first] = searchPlaces('Dizengoff 120', { language: 'en' });
    expect(first).toMatchObject({ addressLine: 'Dizengoff St 120', city: 'Tel Aviv-Yafo', neighborhood: 'Old North' });
    const hebrew = searchPlaces('פלורנטין', { language: 'en' });
    expect(hebrew[0]).toMatchObject({ addressLine: 'פלורנטין', city: 'תל אביב-יפו', neighborhood: 'פלורנטין' });
    expect(searchPlaces('Ramat Gan', { language: 'he', limit: 3 }).every((place) => place.city === 'Ramat Gan')).toBe(true);
    expect(searchPlaces('   ', { language: 'en' })).toEqual([]);
    expect(searchPlaces('zzzz', { language: 'en' })).toEqual([]);
    for (const place of PLACES) {
      expect(place.center.latitude).toBeGreaterThan(31.85);
      expect(place.center.latitude).toBeLessThan(32.2);
      expect(place.center.longitude).toBeGreaterThan(34.73);
      expect(place.center.longitude).toBeLessThan(34.97);
    }
  });

  it('reverse geocodes to the nearest street, keeping the pin', () => {
    const point = { latitude: 32.0567, longitude: 34.7701 };
    const result = reverseGeocode(point, 'he');
    expect(result.city).toBe('תל אביב-יפו');
    expect(result.coordinates).toEqual(point);
  });

  it('serves geo endpoints with the caller’s language', async () => {
    const env = await createTestEnvironment();
    const results = await env.as(DEMO_CUSTOMER_IDS.noa).geo.searchPlaces({ query: 'Herzl', limit: 5 });
    expect(results.length).toBeGreaterThan(1);
    const reverse = await env.as(DEMO_CUSTOMER_IDS.noa).geo.reverseGeocode({ latitude: 32.0823, longitude: 34.8106 });
    expect(reverse.city).toBe('Ramat Gan');
    expect(await expectApiError(env.as(DEMO_CUSTOMER_IDS.noa).geo.reverseGeocode({ latitude: 200, longitude: 0 }))).toMatchObject({
      status: 422,
    });
  });

  it('updates profiles and keeps the account in sync', async () => {
    const env = await createTestEnvironment();
    const updated = await env.as(PRO_IDS.dana).professionals.updateProfessionalProfile({
      displayName: 'Handy Dana & Co.',
      serviceArea: { center: { latitude: 32.0567, longitude: 34.77 }, radiusKm: 20, label: 'Tel Aviv-Yafo' },
    });
    expect(updated).toMatchObject({ displayName: 'Handy Dana & Co.', serviceArea: { radiusKm: 20 } });
    expect((await env.as(PRO_IDS.dana).auth.getCurrentUser()).user.displayName).toBe('Handy Dana & Co.');
    const invalid = await expectApiError(
      env.as(PRO_IDS.dana).professionals.updateProfessionalProfile({ categoryIds: [], yearsOfExperience: -1 }),
    );
    expect(invalid.fieldErrors).toEqual({
      categoryIds: ['validation:category.minOne'],
      yearsOfExperience: ['validation:profile.yearsInvalid'],
    });

    const customer = await env.as(DEMO_CUSTOMER_IDS.noa).customers.updateCustomerProfile({ firstName: 'Noa', lastName: 'Levi-Cohen' });
    expect(customer.user.displayName).toBe('Noa Levi-Cohen');
    const profile = await env.as(DEMO_CUSTOMER_IDS.noa).customers.getCustomerProfile();
    expect(profile.profile.defaultLocation?.addressLine).toBe('Florentin St 24');
  });

  it('builds both dashboards', async () => {
    const env = await createTestEnvironment();
    const customer = await env.as(DEMO_CUSTOMER_IDS.noa).dashboard.getCustomerDashboard();
    expect(customer).toMatchObject({ openRequestsCount: 2, requestsWithOffersCount: 1, pendingOffersCount: 3, activeJobsCount: 1 });
    expect(customer.upcomingJobs.map((job) => job.id)).toEqual([SEED_IDS.jobs.noaLighting]);
    expect(customer.jobsAwaitingReview.map((job) => job.id)).toEqual([SEED_IDS.jobs.noaDishwasher]);

    const pro = await env.as(PRO_IDS.avi).dashboard.getProfessionalDashboard();
    expect(pro.nearbyOpenRequestsCount).toBeGreaterThanOrEqual(3);
    expect(pro.pendingOffersCount).toBe(1);
    expect(pro.pendingOffers[0].request.location.isApproximate).toBe(true);
    expect(pro.newRequests.map((request) => request.id)).not.toContain(SEED_IDS.requests.noaLeak);
    expect(pro.recentNotifications.length).toBeGreaterThan(0);
    expect(pro.earningsThisMonth.currency).toBe('ILS');
    expect(pro.completedJobsCount).toBeGreaterThan(0);

    const search = await env.as(DEMO_CUSTOMER_IDS.noa).professionals.searchProfessionals({
      categoryId: 'plumbing',
      near: { latitude: 32.0567, longitude: 34.77 },
    });
    expect(search.items.map((summary) => summary.id).sort()).toEqual([PRO_IDS.avi, PRO_IDS.eli, PRO_IDS.yossi].sort());
  });
});
