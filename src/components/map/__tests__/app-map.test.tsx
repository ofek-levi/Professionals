/* eslint-disable @typescript-eslint/no-require-imports */
import { act, fireEvent, screen } from '@testing-library/react-native';
import { createRef } from 'react';
import { StyleSheet } from 'react-native';

import { initI18n } from '@/i18n';

import { renderWithProviders } from '../../__test-utils__/render';
import { AppMap } from '../app-map';
import type { AppMapHandle } from '../types';

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-maps', () => require('@/components/map/react-native-maps.mock'));

test('native AppMap renders markers, circles, the pin and zoom controls', async () => {
  await initI18n('en');
  await renderWithProviders(
    <AppMap
      testID="map"
      showZoomControls
      markers={[{ id: 'm1', coordinate: { latitude: 32.08, longitude: 34.78 }, label: 'Plumbing', selected: true }]}
      circles={[{ center: { latitude: 32.08, longitude: 34.78 }, radiusKm: 3 }]}
      draggablePin={{ coordinate: { latitude: 32.07, longitude: 34.77 }, onChange: jest.fn() }}
    />,
  );
  expect(screen.getByTestId('map')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Zoom in' })).toBeOnTheScreen();
});

describe('imperative camera API', () => {
  const home = { latitude: 32.08, longitude: 34.78, latitudeDelta: 0.1, longitudeDelta: 0.1 };

  test('native: animateToRegion moves the map even to the region it already shows', async () => {
    await initI18n('en');
    const MockMapView = require('@/components/map/react-native-maps.mock').default as typeof import('../react-native-maps.mock').default;
    const spy = jest.spyOn(MockMapView.prototype, 'animateToRegion');
    const ref = createRef<AppMapHandle>();
    await renderWithProviders(<AppMap ref={ref} testID="map" region={home} />);
    spy.mockClear();

    await act(async () => ref.current?.animateToRegion(home));
    await act(async () => ref.current?.animateToRegion(home, 100));

    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenNthCalledWith(1, home, 350);
    expect(spy).toHaveBeenNthCalledWith(2, home, 100);
    spy.mockRestore();
  });

  test('web: animateToRegion re-centers the canvas after the camera moved', async () => {
    await initI18n('en');
    const { AppMap: WebAppMap } = require('../app-map.web') as typeof import('../app-map.web');
    const ref = createRef<AppMapHandle>();
    const marker = { id: 'm1', coordinate: { latitude: 32.08, longitude: 34.78 }, accessibilityLabel: 'Job' };
    await renderWithProviders(<WebAppMap ref={ref} testID="map" region={home} markers={[marker]} />);
    await act(async () => {
      fireEvent(screen.getByTestId('map'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 300 } } });
    });
    const markerLeft = () => StyleSheet.flatten(screen.getByRole('button', { name: 'Job' }).props.style).left as number;
    const centered = markerLeft();

    // Zooming changes the camera away from the focus region…
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Zoom out' })));
    await act(async () => ref.current?.animateToRegion({ ...home, longitude: 34.8 }));
    expect(markerLeft()).toBeLessThan(centered);

    // …and the same focus region can be restored, which the `region` prop alone cannot do.
    await act(async () => ref.current?.animateToRegion(home));
    expect(markerLeft()).toBeCloseTo(centered, 5);
  });
});
