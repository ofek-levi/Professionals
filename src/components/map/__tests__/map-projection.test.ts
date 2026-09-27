import { latitudeDeltaToFit, pixelsPerKm, project, unproject, type Viewport } from '../map-projection';

describe('map projection (web canvas)', () => {
  const viewport: Viewport = { center: { latitude: 32.08, longitude: 34.78 }, latitudeDelta: 0.1, width: 400, height: 300 };

  it('projects the center to the middle of the canvas', () => {
    expect(project(viewport, viewport.center)).toEqual({ x: 200, y: 150 });
  });

  it('round-trips between coordinates and pixels', () => {
    const coordinate = { latitude: 32.1, longitude: 34.8 };
    const back = unproject(viewport, project(viewport, coordinate));
    expect(back.latitude).toBeCloseTo(coordinate.latitude, 9);
    expect(back.longitude).toBeCloseTo(coordinate.longitude, 9);
  });

  it('puts north at the top and east on the right', () => {
    const north = project(viewport, { latitude: 32.1, longitude: 34.78 });
    const east = project(viewport, { latitude: 32.08, longitude: 34.8 });
    expect(north.y).toBeLessThan(150);
    expect(east.x).toBeGreaterThan(200);
  });

  it('fits a region into the canvas and scales kilometers', () => {
    const delta = latitudeDeltaToFit({ latitude: 32.08, longitude: 34.78, latitudeDelta: 0.05, longitudeDelta: 0.4 }, 400, 300);
    expect(delta).toBeGreaterThan(0.05);
    expect(pixelsPerKm(viewport)).toBeCloseTo(300 / (0.1 * 110.574), 6);
  });
});
