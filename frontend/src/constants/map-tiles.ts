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
  /** Leaflet URL template (`{z}/{x}/{y}` or `{-y}`, optionally `{s}`/`{r}`), https only. */
  urlTemplate: string;
  maxZoom: number;
  attribution: MapTileAttribution;
}

/** A tile's position as the map requests it (`x` already wrapped into the world). */
export interface TileCoordinates {
  z: number;
  x: number;
  y: number;
}

export const DEFAULT_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/** The OpenStreetMap licence credit (ODbL). Legal notice: intentionally not translated. */
export const OSM_ATTRIBUTION: MapTileAttribution = {
  text: '© OpenStreetMap contributors',
  href: 'https://www.openstreetmap.org/copyright',
};

const MAX_ZOOM = 19;
const MAX_ATTRIBUTION_LENGTH = 200;
/** Leaflet's default `{s}` values. */
const SUBDOMAINS = ['a', 'b', 'c'];
/** The placeholders Leaflet fills; it throws on any other `{name}` (e.g. a provider's `{apikey}`). */
const TILE_PLACEHOLDERS = ['{s}', '{z}', '{x}', '{y}', '{-y}', '{r}'];

function isTileTemplate(value: string): boolean {
  if (!/^https:\/\/[^\s"'<>\\]+$/.test(value)) return false;
  // Every brace must belong to a known placeholder (API keys go into the URL as literal text).
  if (/[{}]/.test(TILE_PLACEHOLDERS.reduce((rest, token) => rest.split(token).join(''), value))) return false;
  return value.includes('{z}') && value.includes('{x}') && (value.includes('{y}') || value.includes('{-y}'));
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
    console.warn(
      `EXPO_PUBLIC_MAP_TILE_URL must be an https URL template with {z}, {x} and {y} (and only {s}, {r} or {-y} besides); using ${DEFAULT_TILE_URL}.`,
    );
  }
  // Control characters (incl. line breaks) are dropped; the page renders the text as text.
  const text = env.attribution?.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, MAX_ATTRIBUTION_LENGTH);
  if (text && !custom && __DEV__) {
    console.warn('EXPO_PUBLIC_MAP_TILE_ATTRIBUTION only applies to a custom EXPO_PUBLIC_MAP_TILE_URL; OpenStreetMap tiles keep their credit.');
  }
  return {
    urlTemplate: custom ?? DEFAULT_TILE_URL,
    maxZoom: MAX_ZOOM,
    // A custom provider needs its own credit; OpenStreetMap tiles (the default, or a custom URL
    // without a credit, e.g. a self-hosted OSM server) always keep the OSM one.
    attribution: custom && text ? { text, href: null } : OSM_ATTRIBUTION,
  };
}

/**
 * The URL of one tile, filled in exactly like Leaflet's `TileLayer` does it (`{s}`: a/b/c by x + y,
 * `{r}`: `@2x` on high-density screens, `{-y}`: the TMS row). Used by the web host, which loads the
 * tiles for its sandboxed page (see `leaflet/web-tile-loader.ts`).
 */
export function buildTileUrl(template: string, { z, x, y }: TileCoordinates, retina: boolean): string {
  const values: Record<string, string> = {
    s: SUBDOMAINS[Math.abs(x + y) % SUBDOMAINS.length],
    z: String(z),
    x: String(x),
    y: String(y),
    '-y': String(2 ** z - 1 - y),
    r: retina ? '@2x' : '',
  };
  return template.replace(/\{(-?[a-z])\}/g, (token: string, key: string) => values[key] ?? token);
}

export const MAP_TILES: MapTileConfig = resolveMapTiles({
  url: process.env.EXPO_PUBLIC_MAP_TILE_URL,
  attribution: process.env.EXPO_PUBLIC_MAP_TILE_ATTRIBUTION,
});
