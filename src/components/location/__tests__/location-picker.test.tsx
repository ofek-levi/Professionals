/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { initI18n } from '@/i18n';
import type { ServiceLocation } from '@/types/domain';

import { renderWithProviders } from '../../__test-utils__/render';
import { AppText } from '../../ui/app-text';
import { LocationPicker } from '../location-picker';

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-maps', () => require('@/components/map/react-native-maps.mock'));
jest.mock('@/services/location', () => ({
  locateDevice: jest.fn(async () => ({ ok: false, reason: 'permission_blocked' })),
  openLocationSettings: jest.fn(async () => undefined),
}));
jest.mock('@/services/api', () => ({
  api: {
    catalog: { getProfessionalCategories: () => new Promise(() => undefined) },
    geo: {
      searchPlaces: jest.fn(async () => [
        { id: 'p1', addressLine: 'Dizengoff St 120', city: 'Tel Aviv-Yafo', neighborhood: 'Center', coordinates: { latitude: 32.08, longitude: 34.77 } },
      ]),
      reverseGeocode: jest.fn(async () => ({
        id: 'r1',
        addressLine: 'Ibn Gabirol St 50',
        city: 'Tel Aviv-Yafo',
        neighborhood: 'Old North',
        coordinates: { latitude: 32.0801, longitude: 34.7801 },
      })),
    },
  },
}));

function Harness({ initial = null }: { initial?: ServiceLocation | null }) {
  const [value, setValue] = useState<ServiceLocation | null>(initial);
  return (
    <>
      <LocationPicker value={value} onChange={setValue} />
      <AppText testID="picked">{value ? `${value.addressLine}|${value.city}|${value.coordinates.latitude}` : 'none'}</AppText>
      <AppText testID="picked-details">{value?.details ?? 'no details'}</AppText>
    </>
  );
}

const SAVED_ADDRESS: ServiceLocation = {
  coordinates: { latitude: 32.082, longitude: 34.813 },
  addressLine: 'Bialik St 45',
  city: 'Ramat Gan',
  neighborhood: 'City Center',
  details: 'Building B, 4th floor',
  isApproximate: false,
};

describe('LocationPicker', () => {
  beforeAll(async () => {
    await initI18n('en');
  });

  it('searches addresses (debounced) and selects a suggestion', async () => {
    await renderWithProviders(<Harness />);
    const search = screen.getByTestId('location-search');
    await fireEvent(search, 'focus');
    await fireEvent.changeText(search, 'Dizen');

    await fireEvent.press(await screen.findByRole('button', { name: 'Dizengoff St 120, Center, Tel Aviv-Yafo' }));
    expect(screen.getByTestId('picked')).toHaveTextContent('Dizengoff St 120|Tel Aviv-Yafo|32.08');
    // Editable address fields appear once a location is chosen.
    expect(screen.getByDisplayValue('Dizengoff St 120')).toBeOnTheScreen();
  });

  it('drops the previous address details when a different address is picked', async () => {
    await renderWithProviders(<Harness initial={SAVED_ADDRESS} />);
    expect(screen.getByTestId('picked-details')).toHaveTextContent('Building B, 4th floor');
    const search = screen.getByTestId('location-search');
    await fireEvent(search, 'focus');
    await fireEvent.changeText(search, 'Dizen');
    await fireEvent.press(await screen.findByRole('button', { name: 'Dizengoff St 120, Center, Tel Aviv-Yafo' }));
    expect(screen.getByTestId('picked')).toHaveTextContent('Dizengoff St 120|Tel Aviv-Yafo|32.08');
    expect(screen.getByTestId('picked-details')).toHaveTextContent('no details');
  });

  it('places the pin on map tap and fills the address by reverse geocoding', async () => {
    await renderWithProviders(<Harness />);
    await fireEvent(screen.getByTestId('mock-map-view'), 'press', {
      nativeEvent: { coordinate: { latitude: 32.0801, longitude: 34.7801 } },
    });
    expect(await screen.findByDisplayValue('Ibn Gabirol St 50')).toBeOnTheScreen();
    expect(screen.getByTestId('picked')).toHaveTextContent('Ibn Gabirol St 50|Tel Aviv-Yafo|32.0801');
  });

  it('explains a blocked location permission with a settings shortcut', async () => {
    await renderWithProviders(<Harness />);
    await fireEvent.press(screen.getByRole('button', { name: 'Use my current location' }));
    expect(await screen.findByText('Location access is blocked')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Open settings' })).toBeOnTheScreen();
  });
});
