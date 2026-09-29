import { DEFAULT_MAP_REGION, regionForRadius } from '@/utils/geo';

import { isValidRegion, resolveInitialRegion } from '../map-region';

const HOME = { latitude: 32.08, longitude: 34.78, latitudeDelta: 0.1, longitudeDelta: 0.1 };
const NONE = { markers: [], circles: [] };

describe('resolveInitialRegion', () => {
  it('prefers the focus region, then the initial region, the pin and the content', () => {
    const pin = { coordinate: { latitude: 32.07, longitude: 34.77 }, onChange: jest.fn() };
    expect(resolveInitialRegion({ ...NONE, region: HOME, initialRegion: DEFAULT_MAP_REGION, pin })).toBe(HOME);
    expect(resolveInitialRegion({ ...NONE, initialRegion: HOME, pin })).toBe(HOME);
    expect(resolveInitialRegion({ ...NONE, pin })).toEqual(regionForRadius(pin.coordinate, 1));
    expect(resolveInitialRegion(NONE)).toBe(DEFAULT_MAP_REGION);
  });

  it('skips regions the map cannot show (e.g. from a malformed radius)', () => {
    const broken = regionForRadius({ latitude: 32.08, longitude: 34.78 }, Number.NaN);
    expect(isValidRegion(broken)).toBe(false);
    expect(resolveInitialRegion({ ...NONE, region: broken, initialRegion: HOME })).toBe(HOME);
    expect(resolveInitialRegion({ ...NONE, region: broken })).toBe(DEFAULT_MAP_REGION);
    const circles = [{ center: { latitude: 32.08, longitude: 34.78 }, radiusKm: Number.NaN }];
    expect(resolveInitialRegion({ markers: [], circles })).toBe(DEFAULT_MAP_REGION);
  });
});

describe('isValidRegion', () => {
  it('needs a valid center and finite, non-negative spans', () => {
    expect(isValidRegion(HOME)).toBe(true);
    expect(isValidRegion({ ...HOME, latitudeDelta: 0 })).toBe(true);
    expect(isValidRegion(undefined)).toBe(false);
    expect(isValidRegion({ ...HOME, latitude: 95 })).toBe(false);
    expect(isValidRegion({ ...HOME, longitudeDelta: Number.POSITIVE_INFINITY })).toBe(false);
    expect(isValidRegion({ ...HOME, latitudeDelta: -1 })).toBe(false);
  });
});
