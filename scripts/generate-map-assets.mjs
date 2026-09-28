#!/usr/bin/env node
/**
 * Generates the static assets of the Leaflet map page (`npm run generate:map-assets`):
 *
 * - src/components/map/leaflet/generated/leaflet-assets.ts – Leaflet's minified JS and CSS as
 *   string constants (source-map comments stripped), inlined into the page so the map needs no CDN.
 * - src/components/map/leaflet/generated/marker-icon-paths.ts – the SVG path of every glyph a
 *   marker can show: each `icon: '…'` of the category catalog plus `MAP_EXTRA_ICONS`
 *   (src/components/map/leaflet/marker-icons.ts), taken from `@mdi/js`.
 *
 * `leaflet` and `@mdi/js` are devDependencies read only here; app code imports the generated files.
 * Run it again after upgrading either package or adding an icon. The output is deterministic
 * (sorted, no timestamps), so an unchanged input produces an unchanged diff.
 */
import { Buffer } from 'node:buffer';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const outDir = join(root, 'src/components/map/leaflet/generated');

/** Reads a file with LF line endings (Leaflet's CSS ships with CRLF). */
const read = (path) => readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n');
const packageVersion = (name) => JSON.parse(read(`node_modules/${name}/package.json`)).version;

/** Removes `//# sourceMappingURL=…` and `/*# sourceMappingURL=… *\/` comments (the maps are not shipped). */
function stripSourceMapComments(source) {
  return source
    .replace(/^[ \t]*\/\/[#@] sourceMappingURL=.*$/gm, '')
    .replace(/\/\*[#@] sourceMappingURL=[^*]*\*\//g, '')
    .trimEnd();
}

/** `pipe-wrench` → `mdiPipeWrench` (the @mdi/js export name). */
function mdiExportName(name) {
  return `mdi${name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')}`;
}

/** Turns a licence file into comment lines. */
function commentBlock(text) {
  return text
    .trim()
    .split('\n')
    .map((line) => (line.trim() ? ` * ${line.trimEnd()}` : ' *'))
    .join('\n');
}

function write(fileName, content) {
  const path = join(outDir, fileName);
  writeFileSync(path, content);
  console.log(`wrote ${relative(root, path)} (${Math.round(Buffer.byteLength(content) / 1024)} KB)`);
}

// ── Leaflet ────────────────────────────────────────────────────────────────────
const leafletVersion = packageVersion('leaflet');
const leafletJs = stripSourceMapComments(read('node_modules/leaflet/dist/leaflet.js'));
const leafletCss = stripSourceMapComments(read('node_modules/leaflet/dist/leaflet.css'));
const leafletLicense = read('node_modules/leaflet/LICENSE');

// ── Marker glyphs ────────────────────────────────────────────────────────────────
const catalogIcons = [...read('src/constants/professional-categories.ts').matchAll(/\bicon:\s*'([a-z0-9-]+)'/g)].map(
  (match) => match[1],
);
if (catalogIcons.length === 0) throw new Error('No `icon: \'…\'` entries found in the category catalog.');

const extrasList = /MAP_EXTRA_ICONS\s*=\s*\[([^\]]*)\]/.exec(read('src/components/map/leaflet/marker-icons.ts'));
if (!extrasList) throw new Error('MAP_EXTRA_ICONS not found in marker-icons.ts.');
const extraIcons = [...extrasList[1].matchAll(/'([a-z0-9-]+)'/g)].map((match) => match[1]);

const mdi = require('@mdi/js');
const mdiVersion = packageVersion('@mdi/js');
const iconNames = [...new Set([...catalogIcons, ...extraIcons])].sort();
const missing = iconNames.filter((name) => typeof mdi[mdiExportName(name)] !== 'string');
if (missing.length > 0) {
  throw new Error(`@mdi/js ${mdiVersion} has no glyph for: ${missing.join(', ')}. Pick another icon name.`);
}
const iconEntries = iconNames.map((name) => `  ${JSON.stringify(name)}: ${JSON.stringify(mdi[mdiExportName(name)])},`);

// ── Output ─────────────────────────────────────────────────────────────────────
const regenerate = ' * GENERATED – do not edit. Regenerate with `npm run generate:map-assets`\n * (scripts/generate-map-assets.mjs).';

mkdirSync(outDir, { recursive: true });

write(
  'leaflet-assets.ts',
  `/**
${regenerate}
 *
 * Leaflet ${leafletVersion} (https://leafletjs.com): minified JavaScript and CSS, inlined into the map
 * page (../map-document.ts) so the map loads without a CDN. Only map tiles come from the network.
 *
 * Leaflet licence:
 *
${commentBlock(leafletLicense)}
 */

export const LEAFLET_VERSION = ${JSON.stringify(leafletVersion)};

export const LEAFLET_JS: string = ${JSON.stringify(leafletJs)};

export const LEAFLET_CSS: string = ${JSON.stringify(leafletCss)};
`,
);

write(
  'marker-icon-paths.ts',
  `/**
${regenerate}
 *
 * SVG path data (24×24 view box) of every glyph a map marker can show: the category catalog icons
 * and MAP_EXTRA_ICONS (../marker-icons.ts), keyed by Material Design Icons name.
 *
 * Material Design Icons ${mdiVersion} (@mdi/js) by Pictogrammers – https://pictogrammers.com.
 * The icons are licensed under the Apache License, Version 2.0:
 * https://www.apache.org/licenses/LICENSE-2.0
 */

export const MARKER_ICON_PATHS: Readonly<Record<string, string>> = {
${iconEntries.join('\n')}
};
`,
);
