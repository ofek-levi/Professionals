/**
 * Raster tiles behind every map (`AppMap`). Defaults to the free OpenStreetMap tile servers; set
 * `EXPO_PUBLIC_MAP_TILE_URL` (and `EXPO_PUBLIC_MAP_TILE_ATTRIBUTION`) to use another provider, e.g.
 * a paid or self-hosted one for production traffic (see the OSM tile usage policy).
 */

export interface MapTileAttribution {
  /** Always shown on the map (the tile licence requires it). */
  text: string;
  /** Licence page the text links to; only the built-in OpenStreetMap credit carries a link. */
  href: string | null;
}

export interface MapTileConfig {
  /** Leaflet URL template (`{z}/{x}/{y}`, optionally `{s}`/`{r}`), https only. */
  urlTemplate: string;
  maxZoom: number;
  attribution: MapTileAttribution;
}

export const DEFAULT_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/** The OpenStreetMap licence credit (ODbL). Legal notice: intentionally not translated. */
export const OSM_ATTRIBUTION: MapTileAttribution = {
  text: '© OpenStreetMap contributors',
  href: 'https://www.openstreetmap.org/copyright',
};

const MAX_ZOOM = 19;
const MAX_ATTRIBUTION_LENGTH = 200;

function isTileTemplate(value: string): boolean {
  return /^https:\/\/[^\s"'<>\\]+$/.test(value) && ['{z}', '{x}', '{y}'].every((token) => value.includes(token));
}

/**
 * Resolves the tile configuration from the (optional) environment overrides. An invalid URL falls
 * back to OpenStreetMap; a custom attribution is plain text only, so configuration can never
 * inject markup into the map page.
 */
export function resolveMapTiles(env: { url?: string; attribution?: string }): MapTileConfig {
  const url = env.url?.trim();
  const custom = url && isTileTemplate(url) ? url : null;
  if (url && !custom && __DEV__) {
    console.warn(`EXPO_PUBLIC_MAP_TILE_URL must be an https URL template with {z}, {x} and {y}; using ${DEFAULT_TILE_URL}.`);
  }
  // Control characters (incl. line breaks) are dropped; the page renders the text as text.
  const text = env.attribution?.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, MAX_ATTRIBUTION_LENGTH);
  return {
    urlTemplate: custom ?? DEFAULT_TILE_URL,
    maxZoom: MAX_ZOOM,
    // A custom provider needs its own credit; the OSM one stays when only the URL changes.
    attribution: text ? { text, href: null } : OSM_ATTRIBUTION,
  };
}

export const MAP_TILES: MapTileConfig = resolveMapTiles({
  url: process.env.EXPO_PUBLIC_MAP_TILE_URL,
  attribution: process.env.EXPO_PUBLIC_MAP_TILE_ATTRIBUTION,
});
