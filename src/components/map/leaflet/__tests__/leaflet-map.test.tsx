import { act, fireEvent, screen } from '@testing-library/react-native';
import { createRef } from 'react';
import { Linking } from 'react-native';

import { initI18n } from '@/i18n';
import { createTheme } from '@/theme';

import { emitMapMessage, injectedMapMessages, mapChannel } from '../../../__test-utils__/map-bridge';
import { renderWithProviders } from '../../../__test-utils__/render';
import { webViewMock } from '../../../__test-utils__/react-native-webview.mock';
import { Screen } from '../../../ui/screen';
import { buildMapPageState } from '../../map-page-state';
import { LeafletMap, MAP_BASE_URL, receiveScript, shouldStartMapLoad } from '../leaflet-map';
import { regionToBounds } from '../map-geometry';
import { serializeHostMessage } from '../map-protocol';
import type { LeafletMapHandle } from '../types';
import { MAP_READY_TIMEOUT_MS } from '../use-map-bridge';

const REGION = { latitude: 32.08, longitude: 34.78, latitudeDelta: 0.1, longitudeDelta: 0.1 };
const LABELS = { map: 'Map', pin: 'Selected location', marker: (label: string) => `Map marker: ${label}` };

function pageState(markerIds: string[] = ['a']) {
  return buildMapPageState({
    theme: createTheme('light', false),
    markers: markerIds.map((id) => ({ id, coordinate: { latitude: 32.08, longitude: 34.78 } })),
    circles: [],
    pin: null,
    interactive: true,
    reduceMotion: false,
    labels: LABELS,
    lang: 'en',
  });
}

const types = () => injectedMapMessages().map((message) => message.type);
const webView = () => screen.getByTestId('map-webview');

beforeAll(async () => {
  await initI18n('en');
});

beforeEach(() => {
  webViewMock.injectJavaScript.mockClear();
});

describe('native LeafletMap host', () => {
  it('queues commands until the page is ready, then sends state, camera and the queue', async () => {
    const ref = createRef<LeafletMapHandle>();
    await renderWithProviders(<LeafletMap ref={ref} state={pageState()} initialRegion={REGION} testID="map" />);
    const target = { ...REGION, latitude: 32.1 };
    await act(async () => ref.current?.animateToRegion(target, 350));
    await act(async () => ref.current?.zoomIn());
    expect(webViewMock.injectJavaScript).not.toHaveBeenCalled();

    await emitMapMessage(webView(), { type: 'ready' });
    const messages = injectedMapMessages();
    // State first: the first camera fit keeps clear of the overlay insets it carries.
    expect(messages.map((message) => message.type)).toEqual(['state', 'setView', 'animateToRegion', 'zoomIn']);
    expect(messages.every((message) => message.channel === mapChannel(webView()))).toBe(true);
    expect(messages[1]).toMatchObject({ bounds: regionToBounds(REGION), exact: false });
    expect(messages[2]).toMatchObject({ bounds: regionToBounds(target), durationMs: 350 });

    // After ready, commands go straight through.
    await act(async () => ref.current?.zoomOut());
    expect(types().at(-1)).toBe('zoomOut');
  });

  it('sends the state again only when its content changed', async () => {
    const { rerender } = await renderWithProviders(<LeafletMap state={pageState()} initialRegion={REGION} />);
    await emitMapMessage(webView(), { type: 'ready' });
    webViewMock.injectJavaScript.mockClear();

    await rerender(<LeafletMap state={pageState()} initialRegion={REGION} />);
    expect(webViewMock.injectJavaScript).not.toHaveBeenCalled();

    await rerender(<LeafletMap state={pageState(['a', 'b'])} initialRegion={REGION} />);
    const messages = injectedMapMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ type: 'state', state: { markers: [{ id: 'a' }, { id: 'b' }] } });
  });

  it('forwards validated page events and ignores foreign or malformed ones', async () => {
    const onMarkerPress = jest.fn();
    const onMapPress = jest.fn();
    const onPinDragEnd = jest.fn();
    const onRegionChange = jest.fn();
    await renderWithProviders(
      <LeafletMap
        state={pageState()}
        initialRegion={REGION}
        onMarkerPress={onMarkerPress}
        onMapPress={onMapPress}
        onPinDragEnd={onPinDragEnd}
        onRegionChange={onRegionChange}
      />,
    );
    const coordinate = { latitude: 32.07, longitude: 34.77 };
    await emitMapMessage(webView(), { type: 'ready' });
    await emitMapMessage(webView(), { type: 'markerPress', id: 'a' });
    await emitMapMessage(webView(), { type: 'mapPress', coordinate });
    await emitMapMessage(webView(), { type: 'pinDragEnd', coordinate });
    await emitMapMessage(webView(), { type: 'regionChange', bounds: regionToBounds(REGION) });
    expect(onMarkerPress).toHaveBeenCalledWith('a');
    expect(onMapPress).toHaveBeenCalledWith(coordinate);
    expect(onPinDragEnd).toHaveBeenCalledWith(coordinate);
    expect(onRegionChange.mock.calls[0][0].latitude).toBeCloseTo(REGION.latitude, 10);

    jest.clearAllMocks();
    await emitMapMessage(webView(), { type: 'markerPress', id: 'a' }, 'zzzzzzzzzzzzzzzzzzzz');
    await emitMapMessage(webView(), { type: 'mapPress', coordinate: { latitude: 'x', longitude: 1 } });
    await act(async () => {
      (webView().props.onMessage as (event: unknown) => void)({ nativeEvent: { data: '{not json' } });
    });
    expect(onMarkerPress).not.toHaveBeenCalled();
    expect(onMapPress).not.toHaveBeenCalled();
  });

  it('keeps the document stable across re-renders', async () => {
    const { rerender } = await renderWithProviders(<LeafletMap state={pageState()} initialRegion={REGION} />);
    const source = webView().props.source as { html: string; baseUrl: string };
    expect(source.baseUrl).toBe(MAP_BASE_URL);
    expect(source.html).toContain('<!doctype html>');
    // Tile requests identify the app (OSM tile usage policy).
    expect(webView().props.applicationNameForUserAgent).toMatch(/^[\w.-]+\/[\w.-]+$/);

    await rerender(<LeafletMap state={pageState(['a', 'b', 'c'])} initialRegion={{ ...REGION, latitude: 10 }} />);
    expect(webView().props.source).toBe(source);
  });

  it('reloads a crashed page and replays camera and state when it is ready again', async () => {
    await renderWithProviders(<LeafletMap state={pageState()} initialRegion={REGION} />);
    await emitMapMessage(webView(), { type: 'ready' });
    const moved = regionToBounds({ ...REGION, latitude: 31.5 });
    await emitMapMessage(webView(), { type: 'regionChange', bounds: moved });
    const before = webView();

    await act(async () => (before.props.onContentProcessDidTerminate as () => void)());
    expect(webView()).not.toBe(before);
    webViewMock.injectJavaScript.mockClear();

    await emitMapMessage(webView(), { type: 'ready' });
    const messages = injectedMapMessages();
    expect(messages.map((message) => message.type)).toEqual(['state', 'setView']);
    // The camera the user left (as it was, not fitted into the insets again), not the initial one.
    expect(messages[1]).toMatchObject({ bounds: moved, exact: true });
  });

  it('shows a localized error with a retry when the page fails or never answers', async () => {
    jest.useFakeTimers();
    try {
      await renderWithProviders(<LeafletMap state={pageState()} initialRegion={REGION} />);
      expect(screen.queryByTestId('map-error')).toBeNull();
      await act(async () => jest.advanceTimersByTime(MAP_READY_TIMEOUT_MS + 1));
      expect(screen.getByText('The map couldn’t load')).toBeOnTheScreen();

      const failed = webView();
      await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
      expect(screen.queryByTestId('map-error')).toBeNull();
      expect(webView()).not.toBe(failed);

      await emitMapMessage(webView(), { type: 'error', message: 'Leaflet did not load', fatal: true });
      expect(screen.getByTestId('map-error')).toBeOnTheScreen();
    } finally {
      jest.useRealTimers();
    }
  });

  it('holds the enclosing ScrollView still while a finger is on the map (iOS)', async () => {
    await renderWithProviders(
      <Screen scrollProps={{ testID: 'scroll' }}>
        <LeafletMap state={pageState()} initialRegion={REGION} testID="map" />
      </Screen>,
    );
    expect(screen.getByTestId('scroll').props.scrollEnabled).toBe(true);
    await fireEvent(screen.getByTestId('map'), 'touchStart', { nativeEvent: { touches: [{}] } });
    expect(screen.getByTestId('scroll').props.scrollEnabled).toBe(false);
    await fireEvent(screen.getByTestId('map'), 'touchEnd', { nativeEvent: { touches: [] } });
    expect(screen.getByTestId('scroll').props.scrollEnabled).toBe(true);
  });
});

describe('navigation policy', () => {
  const request = (url: string, isTopFrame = true) => ({ url, isTopFrame });

  it('allows the initial document load and sub-frame loads', () => {
    expect(shouldStartMapLoad(request(MAP_BASE_URL))).toBe(true);
    expect(shouldStartMapLoad(request('about:blank'))).toBe(true);
    expect(shouldStartMapLoad(request('https://tile.example.com/frame', false))).toBe(true);
  });

  it('opens tapped web links in the browser instead of navigating the map', () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    expect(shouldStartMapLoad(request('https://www.openstreetmap.org/copyright'))).toBe(false);
    expect(openURL).toHaveBeenCalledWith('https://www.openstreetmap.org/copyright');
    // A lookalike of the page origin is just another link.
    expect(shouldStartMapLoad(request('https://localhost.example.com/'))).toBe(false);
    openURL.mockClear();

    expect(shouldStartMapLoad(request('javascript:alert(1)'))).toBe(false);
    expect(shouldStartMapLoad(request('file:///etc/passwd'))).toBe(false);
    expect(shouldStartMapLoad(request('intent://scan/#Intent;scheme=zxing;end'))).toBe(false);
    expect(openURL).not.toHaveBeenCalled();
    openURL.mockRestore();
  });
});

test('injected scripts carry escaped JSON only', () => {
  const json = serializeHostMessage('abcdefghijklmnop1234', {
    type: 'state',
    state: { ...pageState(), accessibilityLabel: '</script>\u2028' },
  });
  const script = receiveScript(json);
  expect(script).not.toMatch(/<\/script|\u2028/);
  expect(script.startsWith('window.__appMap && window.__appMap.receive({')).toBe(true);
});
