import { CATEGORY_GROUPS, PROFESSIONAL_CATEGORIES } from '@/constants/professional-categories';

import { MARKER_ICON_PATHS } from '../generated/marker-icon-paths';
import { DEFAULT_MARKER_ICON, FALLBACK_MARKER_ICON, MAP_EXTRA_ICONS, PIN_ICON, resolveMarkerIcon } from '../marker-icons';

/**
 * The map page draws glyphs from baked SVG paths. When this fails, run
 * `npm run generate:map-assets` (scripts/generate-map-assets.mjs) and commit the generated files.
 */
describe('marker glyph coverage', () => {
  it('has a path for every catalog category and group icon', () => {
    const icons = new Set([...CATEGORY_GROUPS, ...PROFESSIONAL_CATEGORIES].map((item) => item.icon));
    const missing = [...icons].filter((icon) => !MARKER_ICON_PATHS[icon]);
    expect(missing).toEqual([]);
  });

  it('has a path for every extra glyph the map uses', () => {
    const extras = [...MAP_EXTRA_ICONS, DEFAULT_MARKER_ICON, PIN_ICON, FALLBACK_MARKER_ICON];
    expect(extras.filter((icon) => !MARKER_ICON_PATHS[icon])).toEqual([]);
  });

  it('stores plain SVG path data only', () => {
    for (const path of Object.values(MARKER_ICON_PATHS)) {
      expect(path).toMatch(/^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]+$/);
    }
  });
});

test('resolveMarkerIcon falls back for unknown names', () => {
  expect(resolveMarkerIcon('pipe-wrench')).toBe('pipe-wrench');
  expect(resolveMarkerIcon(undefined)).toBe(DEFAULT_MARKER_ICON);
  expect(resolveMarkerIcon('not-a-real-icon')).toBe(FALLBACK_MARKER_ICON);
  expect(resolveMarkerIcon('__proto__')).toBe(FALLBACK_MARKER_ICON);
});
