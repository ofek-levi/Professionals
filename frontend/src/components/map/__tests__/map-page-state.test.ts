import { OSM_ATTRIBUTION } from '@/constants/map-tiles';
import { createTheme } from '@/theme';

import { buildMapPageState, resolvePageInsets } from '../map-page-state';

const LABELS = { map: 'Map', pin: 'Selected location', marker: (label: string) => `Map marker: ${label}` };
const base = {
  markers: [],
  circles: [],
  pin: null,
  interactive: true,
  reduceMotion: false,
  labels: LABELS,
  lang: 'he',
};

describe('buildMapPageState', () => {
  it('resolves tones, glyphs and accessibility labels', () => {
    const theme = createTheme('dark', true);
    const state = buildMapPageState({
      ...base,
      theme,
      markers: [
        { id: 'a', coordinate: { latitude: 32, longitude: 34 }, tone: 'warning', label: 'חשמל', accessibilityLabel: 'Electrical, 2 km away' },
        { id: 'b', coordinate: { latitude: 32.1, longitude: 34.1 }, label: 'Painting' },
        { id: 'c', coordinate: { latitude: 32.1, longitude: 34.1 } },
        // Invalid coordinates never reach the page.
        { id: 'bad', coordinate: { latitude: Number.NaN, longitude: 34 } },
      ],
      circles: [
        { id: 'area', center: { latitude: 32, longitude: 34 }, radiusKm: 12.5, tone: 'accent' },
        { center: { latitude: 32, longitude: 34 }, radiusKm: 0 },
      ],
      pin: { latitude: 32.05, longitude: 34.05 },
    });

    expect(state.markers.map((marker) => marker.id)).toEqual(['a', 'b', 'c']);
    expect(state.markers[0]).toMatchObject({ color: theme.colors.tones.warning.solid, icon: 'map-marker', accessibilityLabel: 'Electrical, 2 km away' });
    expect(state.markers[0].ring).toMatch(/^rgba\(/);
    expect(state.markers[1].accessibilityLabel).toBe('Map marker: Painting');
    expect(state.markers[2].accessibilityLabel).toBeNull();
    expect(state.circles).toEqual([{ id: 'area', latitude: 32, longitude: 34, radiusMeters: 12500, color: theme.colors.tones.accent.solid }]);
    expect(state.pin).toEqual({ latitude: 32.05, longitude: 34.05, accessibilityLabel: 'Selected location' });
    expect(state.theme).toMatchObject({ dark: true, background: theme.colors.surfaceMuted, pin: theme.colors.primaryFill });
    expect(state).toMatchObject({ rtl: true, lang: 'he', tiles: { attribution: OSM_ATTRIBUTION, maxZoom: 19 } });
  });
});

test('resolvePageInsets maps start/end to physical edges and drops invalid values', () => {
  expect(resolvePageInsets({ top: 10, bottom: 80, start: 4, end: 60 }, false)).toEqual({ top: 10, bottom: 80, left: 4, right: 60 });
  expect(resolvePageInsets({ top: 10, bottom: 80, start: 4, end: 60 }, true)).toEqual({ top: 10, bottom: 80, left: 60, right: 4 });
  expect(resolvePageInsets({ top: -5, bottom: Number.NaN }, false)).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
  expect(resolvePageInsets(undefined, false)).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
});
