import { describe, expect, it, vi } from 'vitest';

import { createTestDeps } from '../../../test/app.js';
import { createCustomer, createProfessional, createRequest, TEL_AVIV } from '../../../test/factories.js';
import { approximateCoordinates, fromGeoPoint, haversineDistanceKm, setLocationPrivacySecret } from '../geo.js';

const KEY = 'k7Qp2Vx9Lm4Tz8Rw1Ny6Hs3Jd0Fb5Gc2Xe7Ua9Io4Pk';
const OTHER_KEY = 'Zt3Mq8Wv1Ke6Ry0Pn5Lx2Hj9Sd4Gb7Fc1Ua6Io3Pe8Tk';
const ids = ['66f1a0c2e4b0a1b2c3d4e5f6', '66f1a0c2e4b0a1b2c3d4e5f7', '66f1a0c2e4b0a1b2c3d4e5f8'];

// First: the unit tests below install other keys.
describe('stored approximate points', () => {
  const deps = createTestDeps({ env: { LOCATION_PRIVACY_SECRET: KEY } });

  it('use the LOCATION_PRIVACY_SECRET of the environment (request pin, professional center)', async () => {
    const request = await createRequest(await createCustomer());
    const { professional } = await createProfessional();
    expect(deps.env.locationPrivacySecret).toBe(KEY);

    expect(fromGeoPoint(request.publicPoint)).toEqual(approximateCoordinates(fromGeoPoint(request.location.point), request._id.toHexString()));
    const center = fromGeoPoint(professional.serviceArea.center);
    expect(fromGeoPoint(professional.serviceArea.publicCenter)).toEqual(approximateCoordinates(center, professional._id.toHexString()));
    setLocationPrivacySecret(OTHER_KEY);
    expect(fromGeoPoint(request.publicPoint)).not.toEqual(approximateCoordinates(fromGeoPoint(request.location.point), request._id.toHexString()));
  });
});

describe('approximateCoordinates', () => {
  it('refuses to run before the key is installed (never a silent default)', async () => {
    vi.resetModules();
    const fresh = await import('../geo.js');
    expect(() => fresh.approximateCoordinates(TEL_AVIV, ids[0] ?? '')).toThrow('LOCATION_PRIVACY_SECRET');
  });

  it('moves a point 250–450 m, the same way every time for the same record', () => {
    setLocationPrivacySecret(KEY);
    for (const id of ids) {
      const point = approximateCoordinates(TEL_AVIV, id);
      const shift = haversineDistanceKm(TEL_AVIV, point);
      expect(shift).toBeGreaterThanOrEqual(0.25 - 1e-6);
      expect(shift).toBeLessThanOrEqual(0.45 + 1e-6);
      expect(approximateCoordinates(TEL_AVIV, id)).toEqual(point);
    }
  });

  it('derives the offset from the secret key, not from the public id alone', () => {
    setLocationPrivacySecret(KEY);
    const withKey = ids.map((id) => approximateCoordinates(TEL_AVIV, id));
    setLocationPrivacySecret(OTHER_KEY);
    const withOtherKey = ids.map((id) => approximateCoordinates(TEL_AVIV, id));
    for (const [index, point] of withKey.entries()) expect(point).not.toEqual(withOtherKey[index]);
    // Different records get different offsets.
    expect(new Set(withKey.map((point) => `${point.latitude},${point.longitude}`)).size).toBe(ids.length);
  });
});
