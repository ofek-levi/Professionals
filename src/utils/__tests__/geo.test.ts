import {
  DEFAULT_MAP_REGION,
  haversineDistanceKm,
  isValidCoordinates,
  offsetCoordinates,
  regionForCoordinates,
  regionForRadius,
  roundDistanceKm,
} from '../geo';

const TEL_AVIV = { latitude: 32.0853, longitude: 34.7818 };
const JERUSALEM = { latitude: 31.7683, longitude: 35.2137 };

describe('geo utils', () => {
  it('computes great-circle distances', () => {
    expect(haversineDistanceKm(TEL_AVIV, TEL_AVIV)).toBe(0);
    // Tel Aviv ↔ Jerusalem is ~54 km as the crow flies.
    expect(haversineDistanceKm(TEL_AVIV, JERUSALEM)).toBeGreaterThan(52);
    expect(haversineDistanceKm(TEL_AVIV, JERUSALEM)).toBeLessThan(56);
    expect(haversineDistanceKm(TEL_AVIV, JERUSALEM)).toBeCloseTo(haversineDistanceKm(JERUSALEM, TEL_AVIV), 10);
  });

  it('rounds distances to 0.1 km', () => {
    expect(roundDistanceKm(3.14159)).toBe(3.1);
    expect(roundDistanceKm(0.05)).toBe(0.1);
  });

  it('offsets coordinates by distance and bearing', () => {
    const north = offsetCoordinates(TEL_AVIV, 1000, 0);
    expect(north.latitude).toBeGreaterThan(TEL_AVIV.latitude);
    expect(north.longitude).toBeCloseTo(TEL_AVIV.longitude, 6);
    const east = offsetCoordinates(TEL_AVIV, 350, 90);
    expect(haversineDistanceKm(TEL_AVIV, east)).toBeCloseTo(0.35, 3);
    expect(east.longitude).toBeGreaterThan(TEL_AVIV.longitude);
  });

  it('validates coordinates', () => {
    expect(isValidCoordinates(TEL_AVIV)).toBe(true);
    expect(isValidCoordinates({ latitude: 91, longitude: 0 })).toBe(false);
    expect(isValidCoordinates({ latitude: Number.NaN, longitude: 0 })).toBe(false);
    expect(isValidCoordinates(null)).toBe(false);
  });

  it('builds map regions', () => {
    expect(regionForCoordinates([])).toEqual(DEFAULT_MAP_REGION);
    const region = regionForCoordinates([TEL_AVIV, JERUSALEM], 1);
    expect(region.latitude).toBeCloseTo((TEL_AVIV.latitude + JERUSALEM.latitude) / 2, 6);
    expect(region.latitudeDelta).toBeCloseTo(TEL_AVIV.latitude - JERUSALEM.latitude, 6);
    const single = regionForCoordinates([TEL_AVIV]);
    expect(single.latitudeDelta).toBeGreaterThan(0);
    const circle = regionForRadius(TEL_AVIV, 10);
    expect(circle.latitude).toBe(TEL_AVIV.latitude);
    expect(circle.latitudeDelta).toBeGreaterThan(0.18);
    expect(circle.longitudeDelta).toBeGreaterThan(circle.latitudeDelta);
    expect(DEFAULT_MAP_REGION.latitude).toBeCloseTo(32.08, 1);
  });
});
