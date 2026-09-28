import { act, fireEvent, screen } from '@testing-library/react-native';
import { createRef } from 'react';

import { initI18n } from '@/i18n';
import { DEFAULT_MAP_REGION } from '@/utils/geo';

import { emitMapMessage, getMapWebView, injectedMapMessages } from '../../__test-utils__/map-bridge';
import { renderWithProviders } from '../../__test-utils__/render';
import { webViewMock } from '../../__test-utils__/react-native-webview.mock';
import { Screen } from '../../ui/screen';
import { AppMap } from '../app-map';
import { regionToBounds } from '../leaflet/map-geometry';
import type { MapPageState } from '../leaflet/map-protocol';
import type { AppMapHandle } from '../types';

const HOME = { latitude: 32.08, longitude: 34.78, latitudeDelta: 0.1, longitudeDelta: 0.1 };
const webView = () => getMapWebView();
const lastState = () => injectedMapMessages().filter((message) => message.type === 'state').pop()?.state as MapPageState;

beforeAll(async () => {
  await initI18n('en');
});

beforeEach(() => {
  webViewMock.injectJavaScript.mockClear();
});

describe('AppMap', () => {
  it('sends markers, circles and the pin with theme colors, and shows zoom buttons once ready', async () => {
    await renderWithProviders(
      <AppMap
        testID="map"
        showZoomControls
        markers={[
          { id: 'm1', coordinate: { latitude: 32.08, longitude: 34.78 }, tone: 'danger', icon: 'pipe-wrench', label: 'Plumbing', selected: true },
          { id: 'm2', coordinate: { latitude: 32.09, longitude: 34.79 }, icon: 'no-such-glyph' },
        ]}
        circles={[{ center: { latitude: 32.08, longitude: 34.78 }, radiusKm: 3 }]}
        draggablePin={{ coordinate: { latitude: 32.07, longitude: 34.77 }, onChange: jest.fn() }}
      />,
    );
    expect(screen.getByTestId('map')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Zoom in' })).toBeNull();

    await emitMapMessage(webView(), { type: 'ready' });
    const state = lastState();
    expect(state.markers).toEqual([
      expect.objectContaining({ id: 'm1', color: '#E03131', icon: 'pipe-wrench', label: 'Plumbing', selected: true, accessibilityLabel: 'Map marker: Plumbing' }),
      expect.objectContaining({ id: 'm2', color: '#3B5BDB', icon: 'shape-outline', label: null, selected: false }),
    ]);
    expect(state.circles).toEqual([expect.objectContaining({ id: 'circle-0', radiusMeters: 3000, color: '#3B5BDB' })]);
    expect(state.pin).toEqual({ latitude: 32.07, longitude: 34.77, accessibilityLabel: 'Selected location' });
    expect(state).toMatchObject({ interactive: true, rtl: false, accessibilityLabel: 'Map', theme: { dark: false } });

    webViewMock.injectJavaScript.mockClear();
    await fireEvent.press(screen.getByRole('button', { name: 'Zoom in' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Zoom out' }));
    expect(injectedMapMessages().map((message) => message.type)).toEqual(['zoomIn', 'zoomOut']);
  });

  it('forwards taps, marker presses and pin drags', async () => {
    const onPress = jest.fn();
    const onMarkerPress = jest.fn();
    const onChange = jest.fn();
    await renderWithProviders(
      <AppMap
        markers={[{ id: 'm1', coordinate: { latitude: 32.08, longitude: 34.78 } }]}
        onPress={onPress}
        onMarkerPress={onMarkerPress}
        draggablePin={{ coordinate: { latitude: 32.07, longitude: 34.77 }, onChange }}
      />,
    );
    const coordinate = { latitude: 32.06, longitude: 34.76 };
    await emitMapMessage(webView(), { type: 'ready' });
    await emitMapMessage(webView(), { type: 'mapPress', coordinate });
    await emitMapMessage(webView(), { type: 'markerPress', id: 'm1' });
    await emitMapMessage(webView(), { type: 'pinDragEnd', coordinate });
    expect(onPress).toHaveBeenCalledWith(coordinate);
    expect(onMarkerPress).toHaveBeenCalledWith('m1');
    expect(onChange).toHaveBeenCalledWith(coordinate);
  });

  it('renders a static preview without controls', async () => {
    await renderWithProviders(<AppMap testID="map" interactive={false} showZoomControls accessibilityLabel="Job area" region={HOME} />);
    await emitMapMessage(webView(), { type: 'ready' });
    expect(lastState()).toMatchObject({ interactive: false, accessibilityLabel: 'Job area' });
    expect(screen.queryByRole('button', { name: 'Zoom in' })).toBeNull();
    expect(screen.getByTestId('map').props.accessibilityRole).toBe('image');
  });

  it('leaves the mouse wheel to a scrolling screen around it', async () => {
    const { unmount } = await renderWithProviders(<AppMap />);
    await emitMapMessage(webView(), { type: 'ready' });
    expect(lastState()).toMatchObject({ wheelZoom: true });
    await unmount();

    webViewMock.injectJavaScript.mockClear();
    await renderWithProviders(
      <Screen>
        <AppMap />
      </Screen>,
    );
    await emitMapMessage(webView(), { type: 'ready' });
    expect(lastState()).toMatchObject({ wheelZoom: false });
  });

  it('keeps the attribution and the camera clear of overlays, mirrored in RTL', async () => {
    await renderWithProviders(<AppMap controlInsets={{ bottom: 120, start: 8 }} />, { isRTL: true });
    await emitMapMessage(webView(), { type: 'ready' });
    expect(lastState()).toMatchObject({ rtl: true, insets: { top: 0, bottom: 120, left: 0, right: 8 } });
  });
});

describe('camera', () => {
  it('starts on the focus region and animates when it changes', async () => {
    const { rerender } = await renderWithProviders(<AppMap region={HOME} />);
    await emitMapMessage(webView(), { type: 'ready' });
    expect(injectedMapMessages().find((message) => message.type === 'setView')).toMatchObject({ bounds: regionToBounds(HOME), exact: false });

    webViewMock.injectJavaScript.mockClear();
    await rerender(<AppMap region={{ ...HOME }} />);
    expect(injectedMapMessages().filter((message) => message.type === 'animateToRegion')).toEqual([]);

    const next = { ...HOME, latitude: 32.2 };
    await rerender(<AppMap region={next} />);
    expect(injectedMapMessages().filter((message) => message.type === 'animateToRegion')).toEqual([
      expect.objectContaining({ bounds: regionToBounds(next), durationMs: 350 }),
    ]);
  });

  it('never takes an invalid region as its camera', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const broken = { ...HOME, latitudeDelta: Number.NaN, longitudeDelta: Number.NaN };
    const ref = createRef<AppMapHandle>();
    const { rerender } = await renderWithProviders(<AppMap ref={ref} region={broken} />);
    await emitMapMessage(webView(), { type: 'ready' });
    expect(injectedMapMessages().find((message) => message.type === 'setView')).toMatchObject({ bounds: regionToBounds(DEFAULT_MAP_REGION) });

    webViewMock.injectJavaScript.mockClear();
    await act(async () => ref.current?.animateToRegion(broken));
    await rerender(<AppMap ref={ref} region={{ ...broken, latitude: 31 }} />);
    expect(injectedMapMessages()).toEqual([]);
    jest.restoreAllMocks();
  });

  it('animateToRegion moves the map even to the region it already shows', async () => {
    const ref = createRef<AppMapHandle>();
    await renderWithProviders(<AppMap ref={ref} testID="map" region={HOME} />);
    await emitMapMessage(webView(), { type: 'ready' });
    webViewMock.injectJavaScript.mockClear();

    await act(async () => ref.current?.animateToRegion(HOME));
    await act(async () => ref.current?.animateToRegion(HOME, 100));
    expect(injectedMapMessages()).toEqual([
      expect.objectContaining({ type: 'animateToRegion', bounds: regionToBounds(HOME), durationMs: 350 }),
      expect.objectContaining({ type: 'animateToRegion', bounds: regionToBounds(HOME), durationMs: 100 }),
    ]);
  });
});
