/**
 * Builds the single, self-contained HTML document of the map page: Leaflet's CSS and JS, our CSS,
 * the glyph table and the bridge script are all inline (no `<script src>`, no CDN); only tiles are
 * fetched. The document depends on nothing but the mount's channel id, so hosts build it once per
 * mount – a new WebView `source` would reload the page. Everything dynamic goes through the bridge.
 */
import { LEAFLET_CSS, LEAFLET_JS } from './generated/leaflet-assets';
import { MARKER_ICON_PATHS } from './generated/marker-icon-paths';
import { MAP_PAGE_SCRIPT } from './map-page-script';
import { MAP_PAGE_STYLES } from './map-page-styles';
import { isChannelId, toSafeJson } from './map-protocol';
import { FALLBACK_MARKER_ICON, PIN_ICON } from './marker-icons';

/**
 * Inline code and styles only; images (tiles, inline SVG) over https or data URLs; no fetches,
 * frames, forms or plugins. The host's own injected scripts are not subject to the page CSP.
 * With `hostTiles` (web) the host hands the page its tiles as data URLs, so the page may load
 * nothing from the network at all.
 */
export function mapContentSecurityPolicy({ hostTiles }: { hostTiles: boolean }): string {
  return [
    "default-src 'none'",
    "script-src 'unsafe-inline'",
    "style-src 'unsafe-inline'",
    hostTiles ? 'img-src data:' : 'img-src https: data:',
    "connect-src 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
}

/** Escapes text for an HTML attribute value or text content. */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Keeps inline script text from closing its `<script>` element: `</script` → `<\/script`, which
 * means the same inside JavaScript strings, templates and regular expressions.
 */
export function escapeInlineScript(code: string): string {
  return code.replace(/<\/(script)/gi, '<\\/$1');
}

/** Keeps inline CSS from closing its `<style>` element. */
export function escapeInlineStyle(css: string): string {
  return css.replace(/<\/(style)/gi, '<\\/$1');
}

/**
 * `hostTiles`: the page asks the host for its tiles (`tileRequest`) instead of loading them itself
 * (the web host: a sandboxed frame sends no Referer, see `web-tile-loader.ts`).
 */
export function buildMapDocument({ channel, hostTiles = false }: { channel: string; hostTiles?: boolean }): string {
  if (!isChannelId(channel)) throw new Error('Invalid map channel id');
  const config = { channel, icons: MARKER_ICON_PATHS, fallbackIcon: FALLBACK_MARKER_ICON, pinIcon: PIN_ICON, hostTiles };
  return [
    '<!doctype html>',
    '<html dir="ltr">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">',
    `<meta http-equiv="Content-Security-Policy" content="${escapeHtml(mapContentSecurityPolicy({ hostTiles }))}">`,
    `<style>${escapeInlineStyle(LEAFLET_CSS)}</style>`,
    `<style>${escapeInlineStyle(MAP_PAGE_STYLES)}</style>`,
    '</head>',
    '<body>',
    // The map is never mirrored: geography is the same in every language.
    '<div id="map" dir="ltr"></div>',
    `<script type="application/json" id="app-map-config">${toSafeJson(config)}</script>`,
    `<script>${escapeInlineScript(LEAFLET_JS)}</script>`,
    `<script>${escapeInlineScript(MAP_PAGE_SCRIPT)}</script>`,
    '</body>',
    '</html>',
  ].join('\n');
}
