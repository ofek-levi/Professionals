import type { ServiceRequest } from '@/types/domain';
import { haversineDistanceKm } from '@/utils/geo';

import {
  approximateLocation,
  filterNearbyRequests,
  isRequestMatchForProfessional,
  isRequestOpenForOffers,
  isWithinServiceArea,
  professionalCoversCategory,
  sortNearbyRequests,
  type MatchableProfessional,
} from '../request-matching';

const CENTER = { latitude: 32.0853, longitude: 34.7818 };
const pro: MatchableProfessional = {
  categoryIds: ['plumbing', 'water_heater'],
  serviceArea: { center: CENTER, radiusKm: 10, label: 'Tel Aviv-Yafo' },
};

let sequence = 0;
function request(overrides: Partial<ServiceRequest> & { km?: number } = {}): ServiceRequest {
  sequence += 1;
  const { km = 2, ...rest } = overrides;
  return {
    id: `req_${sequence}`,
    customerId: 'c1',
    categoryId: 'plumbing',
    description: 'Leaking pipe under the sink needs fixing',
    // ~1 km per 0.009 degrees of latitude.
    location: {
      coordinates: { latitude: CENTER.latitude + km * 0.009, longitude: CENTER.longitude },
      addressLine: 'Dizengoff St 1',
      city: 'Tel Aviv-Yafo',
      neighborhood: null,
      details: 'Floor 3',
      isApproximate: false,
    },
    urgency: 'normal',
    preferredSchedule: null,
    photos: [],
    notes: null,
    status: 'open',
    offerCount: 0,
    pendingOfferCount: 0,
    acceptedOfferId: null,
    jobId: null,
    publishedAt: `2026-09-2${sequence % 7}T10:00:00.000Z`,
    cancelledAt: null,
    cancellationReason: null,
    cancellationComment: null,
    createdAt: '2026-09-20T10:00:00.000Z',
    updatedAt: '2026-09-20T10:00:00.000Z',
    ...rest,
  };
}

describe('request matching', () => {
  it('matches categories and service areas', () => {
    expect(professionalCoversCategory(pro, 'plumbing')).toBe(true);
    expect(professionalCoversCategory(pro, 'electrical')).toBe(false);
    expect(isWithinServiceArea(pro.serviceArea, request({ km: 9 }).location.coordinates)).toBe(true);
    expect(isWithinServiceArea(pro.serviceArea, request({ km: 12 }).location.coordinates)).toBe(false);
  });

  it('only takes offers on open requests in the professional’s categories and area', () => {
    expect(isRequestOpenForOffers(request())).toBe(true);
    expect(isRequestOpenForOffers(request({ status: 'offers_received' }))).toBe(true);
    expect(isRequestOpenForOffers(request({ status: 'draft' }))).toBe(false);
    expect(isRequestOpenForOffers(request({ status: 'professional_selected' }))).toBe(false);
    expect(isRequestMatchForProfessional(request(), pro)).toBe(true);
    expect(isRequestMatchForProfessional(request({ categoryId: 'electrical' }), pro)).toBe(false);
    expect(isRequestMatchForProfessional(request({ km: 15 }), pro)).toBe(false);
  });

  it('filters by category (intersected with the pro’s categories) and distance', () => {
    const plumbing = request({ km: 2 });
    const heater = request({ categoryId: 'water_heater', km: 6 });
    const electrical = request({ categoryId: 'electrical', km: 1 });
    const far = request({ km: 11 });
    const all = [plumbing, heater, electrical, far];

    expect(filterNearbyRequests(all, pro).map((r) => r.id)).toEqual([plumbing.id, heater.id]);
    expect(filterNearbyRequests(all, pro, { categoryIds: ['water_heater'] }).map((r) => r.id)).toEqual([heater.id]);
    // Categories outside the professional's own are ignored – nothing matches.
    expect(filterNearbyRequests(all, pro, { categoryIds: ['electrical'] })).toEqual([]);
    expect(filterNearbyRequests(all, pro, { maxDistanceKm: 5 }).map((r) => r.id)).toEqual([plumbing.id]);
    // maxDistanceKm is capped by the service radius.
    expect(filterNearbyRequests(all, pro, { maxDistanceKm: 40 }).map((r) => r.id)).toEqual([plumbing.id, heater.id]);
  });

  it('measures distance to the real location', () => {
    const [result] = filterNearbyRequests([request({ km: 3 })], pro);
    const exact = haversineDistanceKm(CENTER, result.location.coordinates);
    expect(result.distanceKm).toBeCloseTo(Math.round(exact * 10) / 10, 5);
  });

  it('filters by urgency, preferred dates, offer presence and own offers', () => {
    const emergency = request({ urgency: 'emergency' });
    const withDate = request({ preferredSchedule: { date: '2026-10-05', timeWindow: 'morning' } });
    const withOffers = request({ offerCount: 2, pendingOfferCount: 2, status: 'offers_received' });
    const noDate = request();
    // Its only offer expired: counted in the history (`offerCount`) but no competition any more.
    const expiredOnly = request({ offerCount: 1, pendingOfferCount: 0 });
    const all = [emergency, withDate, withOffers, noDate, expiredOnly];

    expect(filterNearbyRequests(all, pro, { urgencies: ['emergency'] }).map((r) => r.id)).toEqual([emergency.id]);
    expect(
      filterNearbyRequests(all, pro, { preferredDateFrom: '2026-10-01', preferredDateTo: '2026-10-10' }).map((r) => r.id),
    ).toEqual([withDate.id]);
    expect(filterNearbyRequests(all, pro, { preferredDateTo: '2026-10-01' })).toEqual([]);
    expect(filterNearbyRequests(all, pro, { offerPresence: 'has_offers' }).map((r) => r.id)).toEqual([withOffers.id]);
    expect(filterNearbyRequests(all, pro, { offerPresence: 'no_offers' }).map((r) => r.id)).toEqual([
      emergency.id,
      withDate.id,
      noDate.id,
      expiredOnly.id,
    ]);
    expect(
      filterNearbyRequests(all, pro, { excludeWithMyOffer: true }, { myActiveOfferRequestIds: new Set([noDate.id]) }),
    ).toHaveLength(4);
    // Without the flag, requests with my offer are still listed.
    expect(filterNearbyRequests(all, pro, {}, { myActiveOfferRequestIds: new Set([noDate.id]) })).toHaveLength(5);
  });

  it('sorts by newest, nearest, urgency and fewest offers', () => {
    const a = {
      ...request({ km: 5, urgency: 'flexible', offerCount: 3, pendingOfferCount: 3, publishedAt: '2026-09-25T10:00:00.000Z' }),
      distanceKm: 5,
    };
    const b = {
      ...request({ km: 1, urgency: 'emergency', offerCount: 4, pendingOfferCount: 1, publishedAt: '2026-09-20T10:00:00.000Z' }),
      distanceKm: 1,
    };
    const c = { ...request({ km: 3, urgency: 'urgent', offerCount: 0, publishedAt: '2026-09-26T10:00:00.000Z' }), distanceKm: 3 };
    expect(sortNearbyRequests([a, b, c], 'newest').map((r) => r.id)).toEqual([c.id, a.id, b.id]);
    expect(sortNearbyRequests([a, b, c], 'nearest').map((r) => r.id)).toEqual([b.id, c.id, a.id]);
    expect(sortNearbyRequests([a, b, c], 'most_urgent').map((r) => r.id)).toEqual([b.id, c.id, a.id]);
    expect(sortNearbyRequests([a, b, c], 'fewest_offers').map((r) => r.id)).toEqual([c.id, b.id, a.id]);
  });

  it('approximates locations deterministically within 250–450 m', () => {
    const original = request().location;
    const approx = approximateLocation(original, 'req_abc');
    expect(approximateLocation(original, 'req_abc')).toEqual(approx);
    expect(approx).toMatchObject({ addressLine: '', details: null, isApproximate: true, city: original.city });
    for (const seed of ['a', 'b', 'c', 'req_1', 'req_2', 'req_3', 'xyz']) {
      const meters = haversineDistanceKm(original.coordinates, approximateLocation(original, seed).coordinates) * 1000;
      expect(meters).toBeGreaterThanOrEqual(249);
      expect(meters).toBeLessThanOrEqual(451);
    }
  });
});
