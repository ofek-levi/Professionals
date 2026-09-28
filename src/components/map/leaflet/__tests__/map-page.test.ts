/**
 * Runs the real map document (Leaflet + bridge script) in jsdom and drives it like a host does:
 * the native host (`window.ReactNativeWebView`) by default, or the web host (a parent window that
 * posts messages, and loads the tiles) with `web: true`.
 * jsdom has no layout, so the map gets a fixed box; tiles never load (no network), which is fine.
 */
import { JSDOM } from 'jsdom';

import { OSM_ATTRIBUTION } from '@/constants/map-tiles';

import { LEAFLET_JS } from '../generated/leaflet-assets';
import { buildMapDocument } from '../map-document';
import { LEAFLET_CREDIT_URL, type MapPageState, type PageMarker } from '../map-protocol';

const CHANNEL = 'abcdefghijklmnop1234';
const VIEW = [
  [32.05, 34.74],
  [32.12, 34.82],
];

type PageWindow = Window & { __appMap: { receive: (message: unknown) => void } };

const THEME: MapPageState['theme'] = {
  dark: false,
  background: '#ECEDF0',
  grid: '#D3D6DC',
  surface: '#FFFFFF',
  text: '#15171C',
  mutedText: '#50555F',
  border: '#E8E9ED',
  link: '#3B5BDB',
  pin: '#3B5BDB',
  onColor: '#FFFFFF',
  shadow: 'rgba(16, 18, 24, 0.08)',
  overlay: 'rgba(12, 14, 20, 0.42)',
  controlBackground: 'rgba(255, 255, 255, 0.85)',
};

const marker = (id: string, overrides: Partial<PageMarker> = {}): PageMarker => ({
  id,
  latitude: 32.08,
  longitude: 34.78,
  color: '#E03131',
  ring: 'rgba(224, 49, 49, 0.25)',
  icon: 'pipe-wrench',
  label: null,
  selected: false,
  accessibilityLabel: `Job ${id}`,
  ...overrides,
});

function pageState(overrides: Partial<MapPageState> = {}): MapPageState {
  return {
    markers: [marker('a'), marker('b', { latitude: 32.09, longitude: 34.79, icon: 'no-such-icon' })],
    circles: [{ id: 'area', latitude: 32.085, longitude: 34.785, radiusMeters: 3000, color: '#3B5BDB' }],
    pin: null,
    theme: THEME,
    tiles: { urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', maxZoom: 19, attribution: OSM_ATTRIBUTION },
    rtl: false,
    interactive: true,
    wheelZoom: true,
    reduceMotion: false,
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
    accessibilityLabel: 'Map',
    lang: 'en',
    ...overrides,
  };
}

function loadPage({ web = false, html = buildMapDocument({ channel: CHANNEL, hostTiles: web }), width = 390 } = {}) {
  const posted: Record<string, unknown>[] = [];
  const size = { width, height: 600 };
  const resizeCallbacks: (() => void)[] = [];
  const record = (data: string) => posted.push(JSON.parse(data) as Record<string, unknown>);
  /** The web host's window, as the page sees it (`window.parent`). */
  const parent = { postMessage: (data: string) => record(data) };
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://localhost/',
    beforeParse(window) {
      Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => size.width });
      Object.defineProperty(window.HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => size.height });
      // Leaflet picks its SVG renderer (circles) only when SVG looks fully supported.
      Object.assign(window.SVGSVGElement.prototype, { createSVGRect: () => ({}) });
      // jsdom's window answers `'addEventListener' in window` with false; Leaflet checks exactly that.
      Object.assign(window, { addEventListener: window.addEventListener, removeEventListener: window.removeEventListener });
      if (web) Object.defineProperty(window, 'parent', { configurable: true, get: () => parent });
      else Object.assign(window, { ReactNativeWebView: { postMessage: record } });
      // jsdom has no ResizeObserver: record the page's callback so a test can report a new size.
      class ResizeObserverStub {
        constructor(callback: () => void) {
          resizeCallbacks.push(callback);
        }
        observe() {}
        disconnect() {}
      }
      Object.assign(window, { ResizeObserver: ResizeObserverStub });
    },
  });
  const window = dom.window as unknown as PageWindow;
  const document = dom.window.document;
  const receive = (message: Record<string, unknown>, channel = CHANNEL) => window.__appMap.receive({ ...message, channel });
  /** A window message as the web host sends it (a JSON string), from `source` (default: the parent). */
  const postFrom = (message: Record<string, unknown>, source: unknown = parent) => {
    const event = new dom.window.MessageEvent('message', { data: JSON.stringify({ ...message, channel: CHANNEL }) });
    Object.defineProperty(event, 'source', { value: source });
    dom.window.dispatchEvent(event);
  };
  /** Posted messages apart from the (debounced) camera reports. */
  const input = () => posted.filter((message) => message.type !== 'regionChange');
  const types = () => input().map((message) => message.type);
  const markers = () => [...document.querySelectorAll<HTMLElement>('.am-marker')];
  const click = (target: Element, x = 20, y = 20) =>
    target.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
  /** The map container got a new size without a window resize (e.g. a hidden screen came back). */
  const resizeContainer = (next: { width: number; height: number }) => {
    Object.assign(size, next);
    resizeCallbacks.forEach((callback) => callback());
  };
  return { dom, window, document, posted, size, receive, postFrom, input, types, markers, click, resizeContainer };
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('map page', () => {
  it('boots and reports ready on its channel', () => {
    const page = loadPage();
    expect(page.posted[0]).toEqual({ type: 'ready', boot: expect.stringMatching(/^[a-z0-9]{16}$/), channel: CHANNEL });
    page.dom.window.close();
  });

  it('repeats ready (same boot id) until the host answers', async () => {
    const page = loadPage();
    await wait(1100);
    const readies = page.posted.filter((message) => message.type === 'ready');
    expect(readies).toHaveLength(3);
    expect(new Set(readies.map((message) => message.boot)).size).toBe(1);

    page.receive({ type: 'state', state: pageState() });
    await wait(600);
    expect(page.posted.filter((message) => message.type === 'ready')).toHaveLength(3);
    page.dom.window.close();
  });

  it('reports a fatal error when Leaflet is missing', () => {
    const html = buildMapDocument({ channel: CHANNEL }).replace(`<script>${LEAFLET_JS}</script>`, '');
    const page = loadPage({ html });
    expect(page.posted).toEqual([{ type: 'error', message: 'Leaflet did not load', fatal: true, channel: CHANNEL }]);
    page.dom.window.close();
  });

  it('renders markers, circles, the pin, the theme and the attribution from state', () => {
    const page = loadPage();
    page.receive({ type: 'setView', bounds: VIEW });
    page.receive({
      type: 'state',
      state: pageState({ pin: { latitude: 32.07, longitude: 34.77, accessibilityLabel: 'Selected location' } }),
    });

    const [first, second] = page.markers();
    expect(page.markers()).toHaveLength(2);
    expect(first.getAttribute('role')).toBe('button');
    expect(first.getAttribute('aria-label')).toBe('Job a');
    expect(first.getAttribute('aria-pressed')).toBe('false');
    expect(first.querySelector('path')?.getAttribute('d')).toMatch(/^M/);
    // Unknown glyphs fall back to the neutral one instead of drawing nothing.
    expect(second.querySelector('path')?.getAttribute('d')).toMatch(/^M/);
    expect(first.querySelector<HTMLElement>('.am-label')?.hidden).toBe(true);
    expect(page.document.querySelectorAll('.leaflet-overlay-pane path')).toHaveLength(1);

    const pin = page.document.querySelector('.am-pin');
    expect(pin?.getAttribute('aria-label')).toBe('Selected location');
    expect(page.document.documentElement.style.getPropertyValue('--am-bg')).toBe('#ECEDF0');
    expect(page.document.querySelector('.leaflet-bottom.leaflet-right .leaflet-control-attribution')?.innerHTML).toContain(
      '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>',
    );
    expect(page.document.querySelector('#map')?.getAttribute('aria-label')).toBe('Map');
    page.dom.window.close();
  });

  it('diffs markers by id: selection updates in place, removed ids disappear', () => {
    const page = loadPage();
    page.receive({ type: 'setView', bounds: VIEW });
    page.receive({ type: 'state', state: pageState() });
    const [first] = page.markers();

    const label = '<img src=x onerror="window.hacked=1">Plumbing';
    page.receive({ type: 'state', state: pageState({ markers: [marker('a', { selected: true, label }), marker('b')] }) });
    expect(page.markers()[0]).toBe(first);
    expect(first.classList.contains('leaflet-marker-icon')).toBe(true);
    expect(first.querySelector('.am-marker-root')?.classList.contains('am-selected')).toBe(true);
    expect(first.getAttribute('aria-pressed')).toBe('true');
    const bubble = first.querySelector<HTMLElement>('.am-label');
    expect(bubble?.hidden).toBe(false);
    // User text is text: no element is created from it.
    expect(bubble?.textContent).toBe(label);
    expect(bubble?.children).toHaveLength(0);
    expect(page.document.querySelector('img[src="x"]')).toBeNull();

    page.receive({ type: 'state', state: pageState({ markers: [marker('a')], circles: [] }) });
    expect(page.markers()).toHaveLength(1);
    expect(page.markers()[0]).toBe(first);
    expect(page.document.querySelectorAll('.leaflet-overlay-pane path')).toHaveLength(0);
    page.dom.window.close();
  });

  it('reports marker taps without a map tap, and map taps after the double-tap window', async () => {
    const page = loadPage();
    page.receive({ type: 'setView', bounds: VIEW });
    page.receive({ type: 'state', state: pageState() });
    page.posted.length = 0;

    page.click(page.markers()[1]);
    await wait(320);
    expect(page.input()).toEqual([{ type: 'markerPress', id: 'b', channel: CHANNEL }]);

    page.posted.length = 0;
    await wait(420);
    page.click(page.document.querySelector('#map')!, 100, 200);
    expect(page.types()).toEqual([]);
    await wait(320);
    expect(page.types()).toEqual(['mapPress']);
    const coordinate = page.input()[0].coordinate as { latitude: number; longitude: number };
    expect(coordinate.latitude).toBeGreaterThan(32.0);
    expect(coordinate.latitude).toBeLessThan(32.2);
    page.dom.window.close();
  });

  it('ignores messages from another channel', () => {
    const page = loadPage();
    page.receive({ type: 'setView', bounds: VIEW });
    page.receive({ type: 'state', state: pageState() }, 'zzzzzzzzzzzzzzzzzzzz');
    expect(page.markers()).toHaveLength(0);
    page.dom.window.close();
  });

  it('static previews expose markers as images and report no taps', async () => {
    const page = loadPage();
    page.receive({ type: 'setView', bounds: VIEW });
    page.receive({ type: 'state', state: pageState({ interactive: false }) });
    expect(page.markers().map((element) => element.getAttribute('role'))).toEqual(['img', 'img']);
    page.posted.length = 0;
    page.click(page.markers()[0]);
    page.click(page.document.querySelector('#map')!, 100, 200);
    await wait(320);
    expect(page.types()).toEqual([]);
    page.dom.window.close();
  });

  it('flips the attribution corner for RTL and keeps it clear of overlays', () => {
    const page = loadPage();
    page.receive({ type: 'setView', bounds: VIEW });
    page.receive({ type: 'state', state: pageState({ rtl: true, insets: { top: 0, right: 0, bottom: 120, left: 8 } }) });
    const corner = page.document.querySelector<HTMLElement>('.leaflet-bottom.leaflet-left');
    expect(corner?.querySelector('.leaflet-control-attribution')).not.toBeNull();
    expect(corner?.style.bottom).toBe('120px');
    expect(corner?.style.left).toBe('8px');
    // The map itself never mirrors.
    expect(page.document.querySelector('#map')?.getAttribute('dir')).toBe('ltr');
    page.dom.window.close();
  });

  it('renders a custom attribution as plain text only', () => {
    const page = loadPage();
    page.receive({ type: 'setView', bounds: VIEW });
    page.receive({
      type: 'state',
      state: pageState({
        tiles: {
          urlTemplate: 'https://tiles.example.com/{z}/{x}/{y}.png',
          maxZoom: 19,
          attribution: { text: '<b onmouseover="x()">Tiles</b>', href: 'javascript:alert(1)' },
        },
      }),
    });
    const attribution = page.document.querySelector('.leaflet-control-attribution');
    expect(attribution?.querySelector('b')).toBeNull();
    expect(attribution?.querySelectorAll('a')).toHaveLength(1); // Leaflet's own credit only
    expect(attribution?.textContent).toContain('<b onmouseover="x()">Tiles</b>');
    page.dom.window.close();
  });

  it('waits for a size before fitting the first view', async () => {
    const page = loadPage({ width: 0 });
    page.receive({ type: 'setView', bounds: VIEW });
    page.receive({ type: 'state', state: pageState() });
    await wait(200);
    expect(page.posted.map((message) => message.type)).not.toContain('regionChange');

    page.size.width = 390;
    page.dom.window.dispatchEvent(new page.dom.window.Event('resize'));
    await wait(200);
    const change = page.posted.find((message) => message.type === 'regionChange');
    const [[south, west], [north, east]] = change?.bounds as number[][];
    expect(south).toBeLessThanOrEqual(32.05);
    expect(north).toBeGreaterThanOrEqual(32.12);
    expect(west).toBeLessThanOrEqual(34.74);
    expect(east).toBeGreaterThanOrEqual(34.82);
    page.dom.window.close();
  });

  it('applies a camera move that arrived while the map was hidden once it has a size again', async () => {
    const page = loadPage();
    page.receive({ type: 'state', state: pageState() });
    page.receive({ type: 'setView', bounds: VIEW });
    await wait(200);
    page.posted.length = 0;
    page.resizeContainer({ width: 0, height: 0 });
    const target = [
      [31.6, 34.3],
      [32.5, 35.3],
    ];
    page.receive({ type: 'animateToRegion', bounds: target, durationMs: 350 });
    await wait(400);
    // A hidden map keeps its camera and reports nothing.
    expect(page.posted).toEqual([]);

    // A shown screen resizes the container but fires no window resize event.
    page.resizeContainer({ width: 390, height: 600 });
    await wait(200);
    const [[south, west], [north, east]] = page.posted.find((message) => message.type === 'regionChange')?.bounds as number[][];
    expect(south).toBeLessThanOrEqual(31.6);
    expect(north).toBeGreaterThanOrEqual(32.5);
    expect(west).toBeLessThanOrEqual(34.3);
    expect(east).toBeGreaterThanOrEqual(35.3);
    page.dom.window.close();
  });

  it('fits the first view clear of the insets, and restores an exact viewport as it was', async () => {
    const insets = { top: 60, right: 0, bottom: 240, left: 0 };
    const spanOf = async (exact: boolean) => {
      const page = loadPage();
      // Hosts send the state first, so the first fit already knows the insets.
      page.receive({ type: 'state', state: pageState({ insets }) });
      page.receive({ type: 'setView', bounds: VIEW, exact });
      await wait(200);
      expect(page.markers()).toHaveLength(2);
      const [[south], [north]] = page.posted.filter((message) => message.type === 'regionChange').pop()?.bounds as number[][];
      page.dom.window.close();
      return { south, north };
    };
    const fitted = await spanOf(false);
    const restored = await spanOf(true);
    // Fitted: VIEW sits between the insets, so the map shows more around it.
    expect(fitted.north - fitted.south).toBeGreaterThan(restored.north - restored.south);
    const bottomOfView = ((fitted.north - VIEW[0][0]) / (fitted.north - fitted.south)) * 600;
    expect(bottomOfView).toBeLessThanOrEqual(600 - insets.bottom + 1);
  });

  it('pans a newly selected marker clear of the insets once, then leaves the camera alone', async () => {
    const page = loadPage();
    const insets = { top: 0, right: 0, bottom: 300, left: 0 };
    // Near the bottom edge of VIEW, i.e. under a bottom card of 300 px.
    const low = marker('low', { latitude: 32.056, longitude: 34.78 });
    const state = (selected: boolean, circles = pageState().circles) =>
      pageState({ reduceMotion: true, insets, circles, markers: [{ ...low, selected, label: 'Plumbing' }] });
    const lastBounds = () => page.posted.filter((message) => message.type === 'regionChange').pop()?.bounds as number[][];
    const markerY = () => {
      const [[south], [north]] = lastBounds();
      return ((north - low.latitude) / (north - south)) * 600;
    };
    page.receive({ type: 'state', state: state(false) });
    page.receive({ type: 'setView', bounds: VIEW, exact: true });
    await wait(200);
    expect(markerY()).toBeGreaterThan(600 - insets.bottom);

    page.receive({ type: 'state', state: state(true) });
    await wait(200);
    // Above the card, with room for the selected dot and its label.
    expect(markerY()).toBeLessThanOrEqual(600 - insets.bottom - 50);

    // Unrelated updates while it stays selected do not move the camera again.
    page.posted.length = 0;
    page.receive({ type: 'state', state: state(true, []) });
    await wait(200);
    expect(page.posted.filter((message) => message.type === 'regionChange')).toEqual([]);
    page.dom.window.close();
  });

  it('zooms on command', async () => {
    const page = loadPage();
    page.receive({ type: 'setView', bounds: VIEW });
    page.receive({ type: 'state', state: pageState({ reduceMotion: true }) });
    await wait(200);
    const span = () => {
      const bounds = page.posted.filter((message) => message.type === 'regionChange').pop()?.bounds as number[][];
      return bounds[1][0] - bounds[0][0];
    };
    const before = span();
    page.receive({ type: 'zoomIn' });
    await wait(200);
    expect(span()).toBeCloseTo(before / 2, 2);
    page.dom.window.close();
  });

  it('keeps a selected marker in view clear of overlays that grow over it', async () => {
    const page = loadPage();
    const low = marker('low', { latitude: 32.075, longitude: 34.78, label: 'Plumbing' });
    const state = (bottom: number, selected = true) =>
      pageState({ reduceMotion: true, insets: { top: 0, right: 0, bottom, left: 0 }, circles: [], markers: [{ ...low, selected }] });
    const markerY = () => {
      const [[south], [north]] = page.posted.filter((message) => message.type === 'regionChange').pop()?.bounds as number[][];
      return ((north - low.latitude) / (north - south)) * 600;
    };
    page.receive({ type: 'state', state: state(0, false) });
    page.receive({ type: 'setView', bounds: VIEW, exact: true });
    // Selected, then its preview card is measured a moment later.
    page.receive({ type: 'state', state: state(80) });
    page.receive({ type: 'state', state: state(300) });
    await wait(200);
    expect(markerY()).toBeLessThanOrEqual(600 - 300 - 50);

    // Later the card grows over the marker, which is still in view: it moves clear again.
    await wait(1000);
    page.receive({ type: 'state', state: state(450) });
    await wait(200);
    expect(markerY()).toBeLessThanOrEqual(600 - 450);
    page.dom.window.close();
  });

  it('keeps a selected marker the user panned away where it is when the overlays change', async () => {
    const page = loadPage();
    const state = (bottom: number, selected = true) =>
      pageState({ reduceMotion: true, insets: { top: 0, right: 0, bottom, left: 0 }, circles: [], markers: [marker('a', { selected, label: 'Plumbing' })] });
    page.receive({ type: 'state', state: state(100, false) });
    page.receive({ type: 'setView', bounds: VIEW, exact: true });
    page.receive({ type: 'state', state: state(100) });
    await wait(1100); // past the settling time of the selection
    // The user moves the map far away from the selected marker.
    const away = [
      [31.0, 34.0],
      [31.07, 34.08],
    ];
    page.receive({ type: 'setView', bounds: away, exact: true });
    await wait(200);
    page.posted.length = 0;
    page.receive({ type: 'state', state: state(260) }); // e.g. its preview card grew
    await wait(200);
    expect(page.posted.filter((message) => message.type === 'regionChange')).toEqual([]);
    page.dom.window.close();
  });

  it('reports the main world copy after the camera wandered around the globe', async () => {
    const page = loadPage();
    page.receive({ type: 'state', state: pageState() });
    // What Leaflet reports after panning three times around the world eastwards.
    page.receive({ type: 'setView', bounds: [[32.05, 34.74 + 1080], [32.12, 34.82 + 1080]], exact: true });
    await wait(200);
    const [[, west], [, east]] = page.posted.filter((message) => message.type === 'regionChange').pop()?.bounds as number[][];
    expect(west).toBeCloseTo(34.74, 1);
    expect(east).toBeCloseTo(34.82, 1);
    page.dom.window.close();
  });

  it('keeps markers, circles, the pin and zoom when the tile template cannot be filled', async () => {
    const page = loadPage();
    const tiles = { urlTemplate: 'https://tiles.example.com/{z}/{x}/{y}.png?key={apikey}', maxZoom: 19, attribution: OSM_ATTRIBUTION };
    // Hosts send the state before the first camera: layers are added when the map gets its view.
    page.receive({ type: 'state', state: pageState({ tiles, reduceMotion: true, pin: { latitude: 32.07, longitude: 34.77, accessibilityLabel: 'Pin' } }) });
    page.receive({ type: 'setView', bounds: VIEW });
    await wait(200);
    expect(page.markers()).toHaveLength(2);
    expect(page.document.querySelectorAll('.leaflet-overlay-pane path')).toHaveLength(1);
    expect(page.document.querySelector('.am-pin')).not.toBeNull();
    expect(page.document.querySelectorAll('img.leaflet-tile')).toHaveLength(0);
    expect(page.posted).toContainEqual({ type: 'error', message: 'Unsupported tile URL template', fatal: false, channel: CHANNEL });

    const span = () => {
      const bounds = page.posted.filter((message) => message.type === 'regionChange').pop()?.bounds as number[][];
      return bounds[1][0] - bounds[0][0];
    };
    const before = span();
    page.receive({ type: 'zoomIn' });
    await wait(200);
    expect(span()).toBeCloseTo(before / 2, 2);
    page.dom.window.close();
  });

  it('leaves the mouse wheel to the page around a map that should not zoom with it', () => {
    const wheel = (wheelZoom: boolean) => {
      const page = loadPage();
      page.receive({ type: 'state', state: pageState({ wheelZoom }) });
      page.receive({ type: 'setView', bounds: VIEW });
      const event = new page.dom.window.WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true });
      page.document.querySelector('#map')?.dispatchEvent(event);
      page.dom.window.close();
      return event.defaultPrevented;
    };
    expect(wheel(true)).toBe(true); // Leaflet zooms and swallows it
    expect(wheel(false)).toBe(false); // it scrolls the screen or sheet around the map
  });

  describe('native host', () => {
    it('never navigates on a link tap: the host opens the credits', () => {
      const page = loadPage();
      page.receive({ type: 'setView', bounds: VIEW });
      page.receive({ type: 'state', state: pageState() });
      page.posted.length = 0;
      const links = [...page.document.querySelectorAll<HTMLAnchorElement>('.leaflet-control-attribution a')];
      // Leaflet's own credit (its attribution prefix) and the tile credit: the links the host opens.
      expect(links.map((link) => link.getAttribute('href'))).toEqual([LEAFLET_CREDIT_URL, OSM_ATTRIBUTION.href]);
      for (const link of links) {
        const event = new page.dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
        link.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
      }
      expect(page.input()).toEqual([
        { type: 'openLink', href: LEAFLET_CREDIT_URL, channel: CHANNEL },
        { type: 'openLink', href: OSM_ATTRIBUTION.href, channel: CHANNEL },
      ]);
      page.dom.window.close();
    });

    it('loads its tiles itself', () => {
      const page = loadPage();
      page.receive({ type: 'state', state: pageState() });
      page.receive({ type: 'setView', bounds: VIEW });
      const sources = [...page.document.querySelectorAll('img.leaflet-tile')].map((tile) => tile.getAttribute('src'));
      expect(sources.length).toBeGreaterThan(0);
      expect(sources.every((source) => source?.startsWith('https://tile.openstreetmap.org/'))).toBe(true);
      expect(page.types()).not.toContain('tileRequest');
      page.dom.window.close();
    });
  });

  describe('web host', () => {
    it('talks to its parent window only', () => {
      const page = loadPage({ web: true });
      expect(page.posted[0]).toMatchObject({ type: 'ready', channel: CHANNEL });

      // Another window (e.g. a second map, or a foreign frame) cannot drive the page.
      page.postFrom({ type: 'setView', bounds: VIEW }, {});
      page.postFrom({ type: 'state', state: pageState() }, {});
      expect(page.markers()).toHaveLength(0);

      page.postFrom({ type: 'setView', bounds: VIEW });
      page.postFrom({ type: 'state', state: pageState() });
      expect(page.markers()).toHaveLength(2);
      page.dom.window.close();
    });

    it('opens links in a new tab', () => {
      const page = loadPage({ web: true });
      page.postFrom({ type: 'setView', bounds: VIEW });
      page.postFrom({ type: 'state', state: pageState() });
      const link = page.document.querySelector<HTMLAnchorElement>(`.leaflet-control-attribution a[href="${OSM_ATTRIBUTION.href}"]`)!;
      const event = new page.dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
      link.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
      expect(page.types()).not.toContain('openLink');
      page.dom.window.close();
    });

    it('asks the host for its tiles and cancels the ones it no longer needs', async () => {
      const page = loadPage({ web: true });
      page.postFrom({ type: 'state', state: pageState({ reduceMotion: true }) });
      page.postFrom({ type: 'setView', bounds: VIEW });
      const requests = page.posted.filter((message) => message.type === 'tileRequest');
      expect(requests.length).toBeGreaterThan(0);
      for (const request of requests) {
        expect(request).toEqual({ type: 'tileRequest', id: expect.stringMatching(/^\d+$/), z: expect.any(Number), x: expect.any(Number), y: expect.any(Number), channel: CHANNEL });
      }
      // The page itself loads nothing.
      expect(page.document.querySelectorAll('img[src^="http"]')).toHaveLength(0);

      const [first] = requests;
      const url = 'data:image/png;base64,iVBORw0KGgo=';
      page.postFrom({ type: 'tile', id: first.id, url });
      expect(page.document.querySelector(`img[data-am-tile="${String(first.id)}"]`)?.getAttribute('src')).toBe(url);

      // Zooming replaces the level: tiles still on their way are cancelled.
      page.postFrom({ type: 'zoomIn' });
      await wait(100);
      const cancelled = page.posted.filter((message) => message.type === 'tileCancel').map((message) => message.id);
      expect(cancelled.length).toBeGreaterThan(0);
      expect(cancelled).not.toContain(first.id);
      page.dom.window.close();
    });

    it('stops asking for tiles a content security policy blocks', async () => {
      const page = loadPage({ web: true });
      page.postFrom({ type: 'state', state: pageState({ reduceMotion: true }) });
      page.postFrom({ type: 'setView', bounds: VIEW });
      const violation = new page.dom.window.Event('securitypolicyviolation');
      Object.assign(violation, { effectiveDirective: 'img-src', blockedURI: 'data' });
      expect(page.document.querySelectorAll('img.leaflet-tile').length).toBeGreaterThan(0);
      page.document.dispatchEvent(violation);
      expect(page.document.querySelectorAll('img.leaflet-tile')).toHaveLength(0);

      page.posted.length = 0;
      page.postFrom({ type: 'zoomIn' });
      page.postFrom({ type: 'state', state: pageState({ reduceMotion: true, circles: [] }) });
      await wait(100);
      expect(page.types()).not.toContain('tileRequest');
      // The credit stays.
      expect(page.document.querySelector('.leaflet-control-attribution')?.textContent).toContain(OSM_ATTRIBUTION.text);
      page.dom.window.close();
    });
  });
});
