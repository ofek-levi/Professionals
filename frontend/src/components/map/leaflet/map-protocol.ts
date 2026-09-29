/**
 * The JSON bridge between a map host (React Native WebView or web iframe) and the Leaflet page.
 *
 * Every message carries the mount's random `channel` id. The host only accepts page messages that
 * pass `parsePageMessage` (right channel, known type, strictly shaped, finite numbers, small), so a
 * foreign frame or a stale page can never drive the app.
 *
 * Host → page: `state` (the full declarative map state; the page diffs it), camera commands and
 * (web) the tiles the host loaded for the page.
 * Page → host: `ready`, user input (`markerPress`, `mapPress`, `pinDragEnd`, `openLink`),
 * `regionChange` after the camera settled, `error`, and (web) `tileRequest` / `tileCancel`.
 */
import type { TileCoordinates } from '@/constants/map-tiles';
import type { GeoCoordinates } from '@/types/domain';

import type { LatLngBoundsLiteral } from './map-geometry';

// ── Page state (host → page) ─────────────────────────────────────────────────────

export interface PageMarker {
  id: string;
  latitude: number;
  longitude: number;
  /** Fill of the marker dot (resolved tone color). */
  color: string;
  /** Halo around a selected marker. */
  ring: string;
  /** Glyph name with baked path data (see marker-icons.ts). */
  icon: string;
  /** Shown in a bubble under a selected marker (user/content text; rendered as text). */
  label: string | null;
  selected: boolean;
  accessibilityLabel: string | null;
}

export interface PageCircle {
  id: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  color: string;
}

export interface PagePin {
  latitude: number;
  longitude: number;
  accessibilityLabel: string;
}

/** Theme colors the page needs (resolved from theme tokens by the host). */
export interface PageTheme {
  dark: boolean;
  /** Map backdrop behind the tiles (visible while tiles load or when they cannot load). */
  background: string;
  /** Backdrop grid lines. */
  grid: string;
  /** Marker outlines and label bubbles. */
  surface: string;
  text: string;
  mutedText: string;
  border: string;
  link: string;
  /** Draggable pin fill and its glyph color. */
  pin: string;
  onColor: string;
  shadow: string;
  /** Ground shadow under the pin. */
  overlay: string;
  /** Translucent background of the attribution. */
  controlBackground: string;
}

/** Physical edge insets (px) kept clear of the attribution and camera fitting. */
export interface PageInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PageTiles {
  urlTemplate: string;
  maxZoom: number;
  attribution: { text: string; href: string | null };
}

export interface MapPageState {
  markers: PageMarker[];
  circles: PageCircle[];
  pin: PagePin | null;
  theme: PageTheme;
  tiles: PageTiles;
  /** Attribution corner flips to the bottom-left; the map itself is never mirrored. */
  rtl: boolean;
  /** `false` = static preview: no gestures, no taps, no keyboard focus. */
  interactive: boolean;
  /** Mouse-wheel zoom (off where the wheel should scroll the page around the map). */
  wheelZoom: boolean;
  reduceMotion: boolean;
  insets: PageInsets;
  /** Accessible name of the map region and the page language. */
  accessibilityLabel: string;
  lang: string;
}

// ── Messages ───────────────────────────────────────────────────────────────────────

export type HostMessage =
  | { type: 'state'; state: MapPageState }
  /**
   * Jump (no animation) – the initial camera (fitted clear of the insets), or after a page reload
   * the viewport it showed before (`exact`: fills the whole map).
   */
  | { type: 'setView'; bounds: LatLngBoundsLiteral; exact: boolean }
  /** `durationMs` 0 or Reduce Motion → instant. */
  | { type: 'animateToRegion'; bounds: LatLngBoundsLiteral; durationMs: number }
  | { type: 'zoomIn' }
  | { type: 'zoomOut' }
  /** Web: a tile the host loaded for `tileRequest` `id` (a `data:image/…` URL; `null` = failed). */
  | { type: 'tile'; id: string; url: string | null };

export type PageMessage =
  /**
   * The page booted. It repeats this until the host answers (a first one can be lost while the
   * host is not listening yet); `boot` is random per page load, so repeats are recognized.
   */
  | { type: 'ready'; boot: string }
  | { type: 'markerPress'; id: string }
  | { type: 'mapPress'; coordinate: GeoCoordinates }
  | { type: 'pinDragEnd'; coordinate: GeoCoordinates }
  | { type: 'regionChange'; bounds: LatLngBoundsLiteral }
  /** Native: a tapped link (the attribution); the page never navigates itself. */
  | { type: 'openLink'; href: string }
  /** Web: the page asks the host to load a tile (see `web-tile-loader.ts`). */
  | ({ type: 'tileRequest'; id: string } & TileCoordinates)
  | { type: 'tileCancel'; id: string }
  /** `fatal`: the page could not start (the host shows its error fallback). */
  | { type: 'error'; message: string; fatal: boolean };

/** Leaflet's own credit, the link its attribution prefix shows next to the tile credit. */
export const LEAFLET_CREDIT_URL = 'https://leafletjs.com';

/** Page messages are tiny; anything bigger is not ours. */
export const MAX_PAGE_MESSAGE_LENGTH = 4096;
const MAX_ID_LENGTH = 256;
const MAX_ERROR_LENGTH = 500;
const MAX_LINK_LENGTH = 2048;
/** Deepest tile zoom a template may serve (Leaflet's own ceiling for raster tiles is far above). */
const MAX_TILE_ZOOM = 24;

const CHANNEL_PATTERN = /^[A-Za-z0-9]{16,64}$/;
const BOOT_PATTERN = /^[A-Za-z0-9]{8,64}$/;
const TILE_ID_PATTERN = /^[A-Za-z0-9]{1,32}$/;
/** An absolute https URL without characters that would need escaping in HTML. */
const LINK_PATTERN = /^https:\/\/[^\s"'<>\\]+$/;

/** A random per-mount channel id (not a secret: it tells this map's messages apart). */
export function createChannelId(): string {
  let id = '';
  while (id.length < 24) id += Math.random().toString(36).slice(2);
  return id.slice(0, 24);
}

export function isChannelId(value: unknown): value is string {
  return typeof value === 'string' && CHANNEL_PATTERN.test(value);
}

/**
 * JSON that is also safe to embed in HTML `<script>` content or evaluate as a JavaScript
 * expression: `<`, `>`, `&` and the JS line terminators U+2028/U+2029 are escaped.
 */
export function toSafeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** The wire form of a host message (a JSON object with the channel). */
export function serializeHostMessage(channel: string, message: HostMessage): string {
  return toSafeJson({ ...message, channel });
}

// ── Parsing (page → host) ────────────────────────────────────────────────────────────

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null && !Array.isArray(value);
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

function parseCoordinate(value: unknown): GeoCoordinates | null {
  if (!isRecord(value)) return null;
  const { latitude, longitude } = value;
  if (!isFiniteNumber(latitude) || !isFiniteNumber(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

const isNumberPair = (value: unknown): value is [number, number] =>
  Array.isArray(value) && value.length === 2 && value.every(isFiniteNumber);

/** Integer tile coordinates inside the world at their zoom (Leaflet wraps `x` before asking). */
function parseTile(data: UnknownRecord): TileCoordinates | null {
  const { z, x, y } = data;
  if (!Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y)) return null;
  const [zoom, column, row] = [z, x, y] as number[];
  if (zoom < 0 || zoom > MAX_TILE_ZOOM) return null;
  const size = 2 ** zoom;
  return column >= 0 && column < size && row >= 0 && row < size ? { z: zoom, x: column, y: row } : null;
}

function parseBounds(value: unknown): LatLngBoundsLiteral | null {
  if (!Array.isArray(value) || value.length !== 2 || !isNumberPair(value[0]) || !isNumberPair(value[1])) return null;
  const [[south, west], [north, east]] = value as LatLngBoundsLiteral;
  // Leaflet reports longitudes beyond ±180 when zoomed out; anything wilder is not a camera.
  if (Math.abs(south) > 90 || Math.abs(north) > 90 || south > north || west > east) return null;
  if (Math.abs(west) > 720 || Math.abs(east) > 720) return null;
  return [
    [south, west],
    [north, east],
  ];
}

/**
 * Validates a raw page message (the JSON string posted by the page). Returns `null` for anything
 * that is not a well-formed message on `channel`.
 */
export function parsePageMessage(raw: unknown, channel: string): PageMessage | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_PAGE_MESSAGE_LENGTH) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(data) || data.channel !== channel || !isChannelId(channel)) return null;

  switch (data.type) {
    case 'ready':
      return typeof data.boot === 'string' && BOOT_PATTERN.test(data.boot) ? { type: 'ready', boot: data.boot } : null;
    case 'markerPress':
      return typeof data.id === 'string' && data.id.length > 0 && data.id.length <= MAX_ID_LENGTH ? { type: 'markerPress', id: data.id } : null;
    case 'mapPress':
    case 'pinDragEnd': {
      const coordinate = parseCoordinate(data.coordinate);
      return coordinate ? { type: data.type, coordinate } : null;
    }
    case 'regionChange': {
      const bounds = parseBounds(data.bounds);
      return bounds ? { type: 'regionChange', bounds } : null;
    }
    case 'openLink':
      return typeof data.href === 'string' && data.href.length <= MAX_LINK_LENGTH && LINK_PATTERN.test(data.href)
        ? { type: 'openLink', href: data.href }
        : null;
    case 'tileRequest': {
      if (typeof data.id !== 'string' || !TILE_ID_PATTERN.test(data.id)) return null;
      const tile = parseTile(data);
      return tile ? { type: 'tileRequest', id: data.id, ...tile } : null;
    }
    case 'tileCancel':
      return typeof data.id === 'string' && TILE_ID_PATTERN.test(data.id) ? { type: 'tileCancel', id: data.id } : null;
    case 'error':
      return typeof data.message === 'string'
        ? { type: 'error', message: data.message.slice(0, MAX_ERROR_LENGTH), fatal: data.fatal === true }
        : null;
    default:
      return null;
  }
}
