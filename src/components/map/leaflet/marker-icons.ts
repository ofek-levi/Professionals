/**
 * Glyphs the map page can draw inside markers (Material Design Icons names, as used by `Icon`).
 *
 * The page cannot load the icon font, so `scripts/generate-map-assets.mjs` bakes the SVG path of
 * every catalog category icon (`icon: '…'` in `src/constants/professional-categories.ts`) plus
 * `MAP_EXTRA_ICONS` into `generated/marker-icon-paths.ts`. After adding a category icon or an extra,
 * run `npm run generate:map-assets` (a Jest test fails until you do).
 */
import { MARKER_ICON_PATHS } from './generated/marker-icon-paths';

/** Glyph of a marker without `icon`. */
export const DEFAULT_MARKER_ICON = 'map-marker';
/** Glyph of the draggable location pin. */
export const PIN_ICON = 'home-map-marker';
/** Neutral glyph for names without baked path data (same fallback as `Icon`). */
export const FALLBACK_MARKER_ICON = 'shape-outline';

/**
 * Non-catalog glyphs the map needs: the three above and the job explorer's unknown-category glyph.
 * Keep this a literal list of names – the generator script reads it as text.
 */
export const MAP_EXTRA_ICONS = ['map-marker', 'home-map-marker', 'shape-outline', 'briefcase-outline'] as const;

export function hasMarkerIcon(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(MARKER_ICON_PATHS, name);
}

/** The glyph a marker actually shows: its own icon, the default one, or the neutral fallback. */
export function resolveMarkerIcon(name: string | undefined): string {
  const icon = name ?? DEFAULT_MARKER_ICON;
  return hasMarkerIcon(icon) ? icon : FALLBACK_MARKER_ICON;
}
