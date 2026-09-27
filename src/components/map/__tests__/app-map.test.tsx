/* eslint-disable @typescript-eslint/no-require-imports */
import { screen } from '@testing-library/react-native';

import { initI18n } from '@/i18n';

import { renderWithProviders } from '../../__test-utils__/render';
import { AppMap } from '../app-map';

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
