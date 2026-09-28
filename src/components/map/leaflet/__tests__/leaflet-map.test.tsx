import { act, fireEvent, screen } from '@testing-library/react-native';
import { createRef } from 'react';
import { Linking } from 'react-native';
import type { ShouldStartLoadRequest, ShouldStartLoadRequestEvent } from 'react-native-webview/lib/WebViewTypes';
// The real policy plumbing of react-native-webview (only the native view is mocked).
import { createOnShouldStartLoadWithRequest } from 'react-native-webview/lib/WebViewShared';

import { initI18n } from '@/i18n';
import { createTheme } from '@/theme';

import { emitMapMessage, getMapWebView, injectedMapMessages, mapChannel } from '../../../__test-utils__/map-bridge';
import { renderWithProviders } from '../../../__test-utils__/render';
import { webViewMock } from '../../../__test-utils__/react-native-webview.mock';
import { Screen } from '../../../ui/screen';
import { buildMapPageState } from '../../map-page-state';
import { LeafletMap, MAP_BASE_URL, ORIGIN_WHITELIST, receiveScript, shouldStartMapLoad } from '../leaflet-map';
import { regionToBounds } from '../map-geometry';
import { LEAFLET_CREDIT_URL, serializeHostMessage } from '../map-protocol';
import type { LeafletMapHandle } from '../types';
import { MAP_READY_TIMEOUT_MS, MAX_AUTO_RELOADS } from '../use-map-bridge';

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
const webView = () => getMapWebView();

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
      // The failed page is gone: nothing under the error for screen readers either.
      expect(screen.queryByTestId('map-webview', { includeHiddenElements: true })).toBeNull();

      await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
      expect(screen.queryByTestId('map-error')).toBeNull();
      expect(webView()).toBeTruthy();

      await emitMapMessage(webView(), { type: 'error', message: 'Leaflet did not load', fatal: true });
      expect(screen.getByTestId('map-error')).toBeOnTheScreen();
    } finally {
      jest.useRealTimers();
    }
  });

  it('shows its own error instead of the WebView library’s English one', async () => {
    await renderWithProviders(<LeafletMap state={pageState()} initialRegion={REGION} />);
    const preventDefault = jest.fn();
    await act(async () => (webView().props.onError as (event: unknown) => void)({ preventDefault, nativeEvent: { code: -1009 } }));
    expect(preventDefault).toHaveBeenCalled();
    expect(screen.getByText('The map couldn’t load')).toBeOnTheScreen();
  });

  it('keeps a static preview’s retry pressable', async () => {
    jest.useFakeTimers();
    try {
      await renderWithProviders(<LeafletMap state={{ ...pageState(), interactive: false }} initialRegion={REGION} />);
      // Touches pass through the page itself...
      expect(screen.getByTestId('map-webview', { includeHiddenElements: true }).parent?.props.style).toContainEqual({ pointerEvents: 'none' });
      await act(async () => jest.advanceTimersByTime(MAP_READY_TIMEOUT_MS + 1));
      // ... but not through the status overlay.
      await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
      expect(screen.queryByTestId('map-error')).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('hides the page from screen readers until it is ready', async () => {
    await renderWithProviders(<LeafletMap state={pageState()} initialRegion={REGION} />);
    expect(screen.queryByTestId('map-webview')).toBeNull();
    await emitMapMessage(webView(), { type: 'ready' });
    expect(screen.getByTestId('map-webview')).toBeTruthy();
  });

  it('reloads a page that keeps crashing only a few times, then offers the retry', async () => {
    await renderWithProviders(<LeafletMap state={pageState()} initialRegion={REGION} />);
    const crash = async () => act(async () => (webView().props.onRenderProcessGone as () => void)());
    for (let reload = 0; reload < MAX_AUTO_RELOADS; reload += 1) {
      const before = webView();
      await crash();
      expect(webView()).not.toBe(before);
    }
    await crash();
    expect(screen.getByTestId('map-error')).toBeOnTheScreen();

    // The user's retry starts over.
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    const retried = webView();
    await crash();
    expect(webView()).not.toBe(retried);
    expect(screen.queryByTestId('map-error')).toBeNull();
  });

  it('answers a repeated ready of the same page load only once', async () => {
    const ref = createRef<LeafletMapHandle>();
    await renderWithProviders(<LeafletMap ref={ref} state={pageState()} initialRegion={REGION} />);
    await emitMapMessage(webView(), { type: 'ready', boot: 'pageload0001' });
    await act(async () => ref.current?.animateToRegion({ ...REGION, latitude: 31 }, 350));
    await emitMapMessage(webView(), { type: 'ready', boot: 'pageload0001' });
    // The repeat would otherwise jump back to the initial camera, undoing the animation.
    expect(types()).toEqual(['state', 'setView', 'animateToRegion']);

    // A new page load (it reloaded by itself) gets everything again.
    await emitMapMessage(webView(), { type: 'ready', boot: 'pageload0002' });
    expect(types()).toEqual(['state', 'setView', 'animateToRegion', 'state', 'setView']);
  });

  it('passes a stable message handler (Android re-subscribes whenever it changes)', async () => {
    const { rerender } = await renderWithProviders(<LeafletMap state={pageState()} initialRegion={REGION} />);
    const { onMessage } = webView().props as { onMessage: unknown };
    await rerender(<LeafletMap state={pageState(['a', 'b'])} initialRegion={REGION} onMapPress={jest.fn()} />);
    expect(webView().props.onMessage).toBe(onMessage);
  });

  it('opens the map’s credit links outside, and nothing else', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    try {
      await renderWithProviders(<LeafletMap state={pageState()} initialRegion={REGION} />);
      await emitMapMessage(webView(), { type: 'ready' });
      await emitMapMessage(webView(), { type: 'openLink', href: 'https://www.openstreetmap.org/copyright' });
      await emitMapMessage(webView(), { type: 'openLink', href: LEAFLET_CREDIT_URL });
      await emitMapMessage(webView(), { type: 'openLink', href: 'https://evil.example.com/' });
      await emitMapMessage(webView(), { type: 'openLink', href: 'tel:+972500000000' });
      expect(openURL.mock.calls).toEqual([['https://www.openstreetmap.org/copyright'], [LEAFLET_CREDIT_URL]]);
    } finally {
      openURL.mockRestore();
    }
  });

  it('holds the enclosing ScrollView still while a finger is on the map (iOS)', async () => {
    await renderWithProviders(
      <Screen scrollProps={{ testID: 'scroll' }}>
        <LeafletMap state={pageState()} initialRegion={REGION} testID="map" />
      </Screen>,
    );
    const touch = (identifier: string) => ({ identifier });
    const scrollEnabled = () => screen.getByTestId('scroll').props.scrollEnabled as boolean;
    expect(scrollEnabled()).toBe(true);
    await fireEvent(screen.getByTestId('map'), 'touchStart', { nativeEvent: { touches: [touch('1')], changedTouches: [touch('1')] } });
    expect(scrollEnabled()).toBe(false);
    await fireEvent(screen.getByTestId('map'), 'touchEnd', { nativeEvent: { touches: [], changedTouches: [touch('1')] } });
    expect(scrollEnabled()).toBe(true);

    // Two-finger pinch on the map: locked until both fingers are up.
    await fireEvent(screen.getByTestId('map'), 'touchStart', { nativeEvent: { touches: [touch('2')], changedTouches: [touch('2')] } });
    await fireEvent(screen.getByTestId('map'), 'touchStart', { nativeEvent: { touches: [touch('2'), touch('3')], changedTouches: [touch('3')] } });
    await fireEvent(screen.getByTestId('map'), 'touchEnd', { nativeEvent: { touches: [touch('3')], changedTouches: [touch('2')] } });
    expect(scrollEnabled()).toBe(false);
    await fireEvent(screen.getByTestId('map'), 'touchEnd', { nativeEvent: { touches: [], changedTouches: [touch('3')] } });
    expect(scrollEnabled()).toBe(true);

    // A finger on the map, another one on the form: lifting the map finger releases the scroll,
    // although the other finger (whose end the map never sees) is still down.
    await fireEvent(screen.getByTestId('map'), 'touchStart', { nativeEvent: { touches: [touch('4')], changedTouches: [touch('4')] } });
    await fireEvent(screen.getByTestId('map'), 'touchEnd', { nativeEvent: { touches: [touch('5')], changedTouches: [touch('4')] } });
    expect(scrollEnabled()).toBe(true);
  });
});

describe('navigation policy', () => {
  const request = (url: string, isTopFrame = true) => ({ url, isTopFrame });

  it('loads nothing but the page itself', () => {
    expect(shouldStartMapLoad(request(MAP_BASE_URL))).toBe(true);
    expect(shouldStartMapLoad(request('about:blank'))).toBe(true);
    for (const url of [
      'https://www.openstreetmap.org/copyright',
      'https://localhost.example.com/',
      'javascript:alert(1)',
      'file:///etc/passwd',
      'intent://scan/#Intent;scheme=zxing;end',
      'tel:+972500000000',
    ]) {
      expect(shouldStartMapLoad(request(url))).toBe(false);
    }
    // The page has no frames (CSP frame-src 'none'): none may load either.
    expect(shouldStartMapLoad(request('https://tile.example.com/frame', false))).toBe(false);
    expect(shouldStartMapLoad(request(MAP_BASE_URL, false))).toBe(false);
  });

  it('decides every navigation the WebView asks about (the library opens rejected origins itself)', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const canOpenURL = jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
    try {
      await renderWithProviders(<LeafletMap state={pageState()} initialRegion={REGION} />);
      const { originWhitelist, onShouldStartLoadWithRequest } = webView().props as {
        originWhitelist: readonly string[];
        onShouldStartLoadWithRequest: (request: ShouldStartLoadRequest) => boolean;
      };
      expect(originWhitelist).toEqual(ORIGIN_WHITELIST);
      // The handler react-native-webview builds from these props, as the native view calls it.
      const decide = jest.fn();
      const handle = createOnShouldStartLoadWithRequest(decide, originWhitelist, onShouldStartLoadWithRequest);
      const urls = [MAP_BASE_URL, 'https://www.openstreetmap.org/copyright', 'intent://x#Intent;end', 'tel:123', 'market://details?id=x'];
      urls.forEach((url, lockIdentifier) =>
        handle({ nativeEvent: { url, lockIdentifier, isTopFrame: true, navigationType: 'click' } } as unknown as ShouldStartLoadRequestEvent),
      );
      await act(async () => undefined);
      expect(decide.mock.calls).toEqual(urls.map((url, lockIdentifier) => [url === MAP_BASE_URL, url, lockIdentifier]));
      expect(canOpenURL).not.toHaveBeenCalled();
      expect(openURL).not.toHaveBeenCalled();
    } finally {
      openURL.mockRestore();
      canOpenURL.mockRestore();
    }
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
