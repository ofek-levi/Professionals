/**
 * Web: loads the map tiles for the sandboxed map page.
 *
 * The page runs in an `<iframe srcdoc sandbox>` without `allow-same-origin`, so it has an opaque
 * origin and its requests carry no `Referer` – which the OSM tile servers require from browsers
 * (tile usage policy) and refuse without. The host – the app's own document, with a real origin –
 * therefore fetches each tile (`Referer`: the app's origin, never a path) and hands it to the page
 * as a data URL; the page itself loads nothing. The browser's HTTP cache applies as for images.
 *
 * Tile servers must allow CORS: the OSM servers and the common providers answer with
 * `Access-Control-Allow-Origin: *`.
 */
import { buildTileUrl } from '@/constants/map-tiles';

import type { TileLoader } from './use-map-bridge';

const IMAGE_TYPE = /^image\/[a-z0-9.+-]+$/i;
const ORIGIN = /^https?:\/\/[^/?#]+/i;
/** Raster tiles are a few dozen KB; anything this large is not one. */
const MAX_TILE_BYTES = 2_000_000;
const BASE64_CHUNK = 0x8000;

/** Tile origins a content security policy of this page blocks (it applies to every map on it). */
const blockedOrigins = new Set<string>();
let watchingPolicy = false;

/** A strict page CSP refuses every tile: stop asking instead of reporting a violation per tile. */
function watchContentSecurityPolicy() {
  if (watchingPolicy || typeof document === 'undefined') return;
  watchingPolicy = true;
  document.addEventListener('securitypolicyviolation', (event) => {
    const origin = ORIGIN.exec(event.blockedURI)?.[0].toLowerCase();
    if (origin && /^(connect-src|default-src)/.test(event.effectiveDirective)) blockedOrigins.add(origin);
  });
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += BASE64_CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(index, index + BASE64_CHUNK));
  }
  return btoa(binary);
}

async function toDataUrl(response: Response): Promise<string | null> {
  const type = (response.headers.get('content-type') ?? '').split(';')[0].trim();
  if (!response.ok || !IMAGE_TYPE.test(type)) return null;
  const bytes = new Uint8Array(await response.arrayBuffer());
  return bytes.length > 0 && bytes.length <= MAX_TILE_BYTES ? `data:${type};base64,${toBase64(bytes)}` : null;
}

const noop = () => undefined;

export function createWebTileLoader({
  fetchTile = (url, init) => fetch(url, init),
  retina = typeof window !== 'undefined' && window.devicePixelRatio > 1,
}: {
  fetchTile?: (url: string, init: RequestInit) => Promise<Response>;
  /** Fills `{r}` with `@2x` (as Leaflet does on high-density screens). */
  retina?: boolean;
} = {}): TileLoader {
  watchContentSecurityPolicy();
  return {
    load: (template, tile, done) => {
      const url = buildTileUrl(template, tile, retina);
      const origin = ORIGIN.exec(url)?.[0].toLowerCase();
      if (!origin || blockedOrigins.has(origin)) {
        done(null);
        return noop;
      }
      const controller = new AbortController();
      void fetchTile(url, {
        mode: 'cors',
        credentials: 'omit',
        // Explicit, so an app-wide `no-referrer` policy cannot get the tiles refused.
        referrerPolicy: 'strict-origin-when-cross-origin',
        signal: controller.signal,
      })
        .then(toDataUrl)
        .catch(() => null)
        .then((dataUrl) => {
          if (!controller.signal.aborted) done(dataUrl);
        });
      return () => controller.abort();
    },
  };
}
