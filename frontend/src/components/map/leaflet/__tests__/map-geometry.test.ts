import { boundsToRegion, MAX_MERCATOR_LATITUDE, regionToBounds, wrapLongitude } from '../map-geometry';

const TEL_AVIV = { latitude: 32.08, longitude: 34.78, latitudeDelta: 0.2, longitudeDelta: 0.1 };

describe('regionToBounds', () => {
  it('spans the deltas around the center as [[south, west], [north, east]]', () => {
    const [[south, west], [north, east]] = regionToBounds(TEL_AVIV);
    expect(south).toBeCloseTo(31.98, 10);
    expect(north).toBeCloseTo(32.18, 10);
    expect(west).toBeCloseTo(34.73, 10);
    expect(east).toBeCloseTo(34.83, 10);
  });

  it('round-trips with boundsToRegion', () => {
    const region = boundsToRegion(regionToBounds(TEL_AVIV));
    expect(region.latitude).toBeCloseTo(TEL_AVIV.latitude, 10);
    expect(region.longitude).toBeCloseTo(TEL_AVIV.longitude, 10);
    expect(region.latitudeDelta).toBeCloseTo(TEL_AVIV.latitudeDelta, 10);
    expect(region.longitudeDelta).toBeCloseTo(TEL_AVIV.longitudeDelta, 10);
  });

  it('clamps latitudes to Web Mercator and gives a point a minimal size', () => {
    const [[south], [north]] = regionToBounds({ latitude: 84, longitude: 0, latitudeDelta: 10, longitudeDelta: 10 });
    expect(north).toBe(MAX_MERCATOR_LATITUDE);
    expect(south).toBe(79);

    const [[pointSouth, pointWest], [pointNorth, pointEast]] = regionToBounds({ latitude: 32, longitude: 34, latitudeDelta: 0, longitudeDelta: 0 });
    expect(pointNorth - pointSouth).toBeGreaterThan(0);
    expect(pointEast - pointWest).toBeGreaterThan(0);
  });

  it('lets bounds cross the antimeridian instead of flipping them', () => {
    const [[, west], [, east]] = regionToBounds({ latitude: 0, longitude: 179, latitudeDelta: 4, longitudeDelta: 4 });
    expect(west).toBe(177);
    expect(east).toBe(181);
  });
});

describe('boundsToRegion', () => {
  it('normalizes the center longitude and caps the spans to the world', () => {
    const region = boundsToRegion([
      [-10, 170],
      [10, 200],
    ]);
    expect(region.longitude).toBeCloseTo(-175, 10);
    expect(region.latitudeDelta).toBe(20);
    expect(region.longitudeDelta).toBe(30);
    expect(
      boundsToRegion([
        [-85, -400],
        [85, 400],
      ]).longitudeDelta,
    ).toBe(360);
  });
});

test('wrapLongitude', () => {
  expect(wrapLongitude(34.78)).toBeCloseTo(34.78, 10);
  expect(wrapLongitude(190)).toBeCloseTo(-170, 10);
  expect(wrapLongitude(-190)).toBeCloseTo(170, 10);
  expect(wrapLongitude(540)).toBeCloseTo(-180, 10);
});
