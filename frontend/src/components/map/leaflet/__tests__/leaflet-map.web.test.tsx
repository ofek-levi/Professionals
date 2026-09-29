/**
 * @jest-environment jsdom
 */
/**
 * The web host (`leaflet-map.web.tsx`): the sandboxed iframe, where messages are accepted from, and
 * the tiles it loads for the page. The iframe renders as a plain host element here; its window is a
 * real jsdom window attached to it by the test.
 */
import { act, screen } from '@testing-library/react-native';

import { initI18n } from '@/i18n';
import { createTheme } from '@/theme';

import { renderWithProviders } from '../../../__test-utils__/render';
import { buildMapPageState } from '../../map-page-state';
import { LeafletMap, MAP_FRAME_SANDBOX } from '../leaflet-map.web';
import { createWebTileLoader } from '../web-tile-loader';

const REGION = { latitude: 32.08, longitude: 34.78, latitudeDelta: 0.1, longitudeDelta: 0.1 };
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

/** A tile server's answer (jsdom has no `Response`). */
const tileResponse = (bytes: Uint8Array, type = 'image/png', ok = true) =>
  ({ ok, headers: { get: () => type }, arrayBuffer: async () => bytes.buffer }) as unknown as Response;

const state = buildMapPageState({
  theme: createTheme('light', false),
  markers: [],
  circles: [],
  pin: null,
  interactive: true,
  reduceMotion: false,
  labels: { map: 'Map', pin: 'Pin', marker: (label) => label },
  lang: 'en',
});

type FrameElement = ReturnType<typeof screen.getByTestId> & { contentWindow?: Window };

/** The rendered `<iframe>` (the same instance its ref points to). */
const getFrame = () => screen.container.queryAll((node) => node.type === 'iframe')[0] as FrameElement;

/** Renders the host and gives its iframe a window to talk to. */
async function renderHost() {
  const view = await renderWithProviders(<LeafletMap state={state} initialRegion={REGION} />);
  const frame = getFrame();
  const holder = document.createElement('iframe');
  document.body.appendChild(holder);
  const frameWindow = holder.contentWindow!;
  const postMessage = jest.spyOn(frameWindow, 'postMessage').mockImplementation(() => undefined);
  frame.contentWindow = frameWindow;
  const channel = /"channel":"([A-Za-z0-9]+)"/.exec(frame.props.srcDoc as string)![1];
  const sent = () => postMessage.mock.calls.map(([data]) => JSON.parse(data as string) as Record<string, unknown>);
  /** A message from `source` (default: the map's own frame). */
  const emit = async (message: Record<string, unknown>, source: Window = frameWindow) => {
    await act(async () => {
      window.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ ...message, channel }), source }));
    });
  };
  return { ...view, frame, sent, emit };
}

beforeAll(async () => {
  await initI18n('en');
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('web LeafletMap host', () => {
  it('sandboxes the page without its own origin', async () => {
    const { frame } = await renderHost();
    expect(frame.props.sandbox).toBe('allow-scripts allow-popups allow-popups-to-escape-sandbox');
    expect(MAP_FRAME_SANDBOX).not.toContain('allow-same-origin');
    // The page asks the host for its tiles and may load nothing itself.
    expect(frame.props.srcDoc).toContain('"hostTiles":true');
    expect(frame.props.srcDoc).toContain('img-src data:;');
  });

  it('accepts messages from its own frame only, and sends nothing before the page is ready', async () => {
    const { sent, emit, frame } = await renderHost();
    const other = document.body.appendChild(document.createElement('iframe')).contentWindow!;
    await emit({ type: 'ready', boot: 'pageload0001' }, other);
    await emit({ type: 'ready', boot: 'pageload0001' }, window);
    expect(sent()).toEqual([]);
    expect(frame.props['aria-hidden']).toBe(true);

    await emit({ type: 'ready', boot: 'pageload0001' });
    expect(sent().map((message) => message.type)).toEqual(['state', 'setView']);
    expect(getFrame().props['aria-hidden']).toBeUndefined();
  });

  it('removes its message listener when unmounted', async () => {
    const remove = jest.spyOn(window, 'removeEventListener');
    const add = jest.spyOn(window, 'addEventListener');
    const { unmount } = await renderHost();
    const listener = add.mock.calls.find(([type]) => type === 'message')?.[1];
    expect(listener).toBeDefined();
    await unmount();
    expect(remove).toHaveBeenCalledWith('message', listener);
  });

  it('loads the tiles the page asks for with the app’s origin as Referer, as data URLs', async () => {
    const fetchTile = jest.fn(async (_url: string, _init: RequestInit) => tileResponse(PNG));
    const { fetch: originalFetch } = globalThis;
    Object.assign(globalThis, { fetch: fetchTile });
    try {
      const { sent, emit } = await renderHost();
      await emit({ type: 'ready', boot: 'pageload0001' });
      await emit({ type: 'tileRequest', id: '7', z: 12, x: 2446, y: 1662 });
      await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
      expect(fetchTile).toHaveBeenCalledWith(
        'https://tile.openstreetmap.org/12/2446/1662.png',
        expect.objectContaining({ mode: 'cors', credentials: 'omit', referrerPolicy: 'strict-origin-when-cross-origin' }),
      );
      expect(sent().at(-1)).toMatchObject({ type: 'tile', id: '7', url: `data:image/png;base64,${btoa(String.fromCharCode(...PNG))}` });
    } finally {
      Object.assign(globalThis, { fetch: originalFetch });
    }
  });
});

describe('web tile loader', () => {
  it('stops fetching from a tile server the page’s content security policy blocks', async () => {
    const fetchTile = jest.fn(async (_url: string, _init: RequestInit) => {
      throw new TypeError('Failed to fetch');
    });
    const loader = createWebTileLoader({ fetchTile, retina: false });
    const done = jest.fn();
    loader.load('https://tiles.blocked.example/{z}/{x}/{y}.png', { z: 1, x: 0, y: 0 }, done);
    // The browser reports the refused request.
    const violation = new Event('securitypolicyviolation');
    Object.assign(violation, { effectiveDirective: 'connect-src', blockedURI: 'https://tiles.blocked.example/1/0/0.png' });
    document.dispatchEvent(violation);
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
    expect(done).toHaveBeenCalledWith(null);

    loader.load('https://tiles.blocked.example/{z}/{x}/{y}.png', { z: 1, x: 1, y: 0 }, done);
    expect(done).toHaveBeenLastCalledWith(null);
    expect(fetchTile).toHaveBeenCalledTimes(1);
  });
});
