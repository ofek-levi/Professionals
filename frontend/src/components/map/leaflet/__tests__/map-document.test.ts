import { LEAFLET_CSS, LEAFLET_JS } from '../generated/leaflet-assets';
import { MARKER_ICON_PATHS } from '../generated/marker-icon-paths';
import { buildMapDocument, escapeHtml, escapeInlineScript, escapeInlineStyle, mapContentSecurityPolicy } from '../map-document';
import { MAP_PAGE_SCRIPT } from '../map-page-script';
import { MAP_PAGE_STYLES } from '../map-page-styles';

const CHANNEL = 'abcdefghijklmnop1234';

describe('buildMapDocument', () => {
  const html = buildMapDocument({ channel: CHANNEL });

  it('is one complete document with Leaflet, our styles and the bridge inline', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
    expect(html).toContain(LEAFLET_JS.slice(0, 200));
    expect(html).toContain(LEAFLET_CSS.slice(0, 200));
    expect(html).toContain('window.__appMap = { receive: receive };');
    expect(html).toContain('<div id="map" dir="ltr"></div>');
    // Four inline scripts/styles at most, and nothing loaded from elsewhere.
    expect(html).not.toMatch(/<script[^>]*\bsrc\s*=/i);
    expect(html).not.toMatch(/<link\b/i);
    expect(html).not.toMatch(/sourceMappingURL/);
    expect(html).toContain(`content="${escapeHtml(mapContentSecurityPolicy({ hostTiles: false }))}"`);
  });

  it('lets a page whose host loads its tiles (web) load nothing itself', () => {
    const web = buildMapDocument({ channel: CHANNEL, hostTiles: true });
    const policy = mapContentSecurityPolicy({ hostTiles: true });
    expect(web).toContain(`content="${escapeHtml(policy)}"`);
    expect(policy).toContain('img-src data:;');
    expect(policy).not.toMatch(/https:/);
    expect(mapContentSecurityPolicy({ hostTiles: false })).toContain('img-src https: data:;');
    expect(web).toContain('"hostTiles":true');
    expect(html).toContain('"hostTiles":false');
  });

  it('embeds the channel and glyph table as parseable JSON', () => {
    const match = /<script type="application\/json" id="app-map-config">([\s\S]*?)<\/script>/.exec(html);
    expect(match).not.toBeNull();
    const config = JSON.parse(match![1]) as { channel: string; icons: Record<string, string>; fallbackIcon: string; pinIcon: string; hostTiles: boolean };
    expect(config.channel).toBe(CHANNEL);
    expect(config.icons).toEqual(MARKER_ICON_PATHS);
    expect(config.icons[config.fallbackIcon]).toBeDefined();
    expect(config.icons[config.pinIcon]).toBeDefined();
  });

  it('depends only on the channel and the tile source (hosts build it once per mount)', () => {
    expect(buildMapDocument({ channel: CHANNEL })).toBe(html);
    expect(buildMapDocument({ channel: 'zyxwvutsrqponmlk9876' })).not.toBe(html);
  });

  it('refuses a channel that could break out of the markup', () => {
    expect(() => buildMapDocument({ channel: '"><script>alert(1)</script>' })).toThrow();
    expect(() => buildMapDocument({ channel: '' })).toThrow();
  });

  it('never lets inline code close its element early', () => {
    const scripts = html.split('<script').length - 1;
    expect(scripts).toBe(3);
    expect(html.split('</script>').length - 1).toBe(3);
    expect(html.split('</style>').length - 1).toBe(2);
  });
});

describe('escaping', () => {
  it('escapes closing tags inside inline code', () => {
    expect(escapeInlineScript('var a = "</script><script>alert(1)</script>";')).toBe('var a = "<\\/script><script>alert(1)<\\/script>";');
    expect(escapeInlineScript('x = "</SCRIPT"')).toBe('x = "<\\/SCRIPT"');
    expect(escapeInlineStyle('a{content:"</style><script>"}')).toBe('a{content:"<\\/style><script>"}');
  });

  it('escapes HTML text and attributes', () => {
    expect(escapeHtml(`<a href="x" onclick='y'>&</a>`)).toBe('&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
  });
});

describe('page script', () => {
  it('is plain ASCII source text (no function stringification, no template interpolation)', () => {
    expect(typeof MAP_PAGE_SCRIPT).toBe('string');
    expect(MAP_PAGE_SCRIPT.startsWith('(function () {')).toBe(true);
    expect(MAP_PAGE_SCRIPT).not.toContain('`');
    expect(MAP_PAGE_SCRIPT).not.toContain('${');
    expect(MAP_PAGE_SCRIPT).toMatch(/^[\x09\x0a\x20-\x7e]*$/);
    expect(MAP_PAGE_STYLES).toMatch(/^[\x09\x0a\x20-\x7e]*$/);
    // Valid JavaScript on its own.
    expect(() => new Function(MAP_PAGE_SCRIPT)).not.toThrow();
  });

  it('only writes user text through textContent and escaped markup', () => {
    expect(MAP_PAGE_SCRIPT).not.toMatch(/\.innerHTML\s*=/);
    expect(MAP_PAGE_SCRIPT).not.toMatch(/insertAdjacentHTML|document\.write|\beval\(/);
    expect(MAP_PAGE_SCRIPT).toContain('entry.label.textContent = label;');
  });
});
