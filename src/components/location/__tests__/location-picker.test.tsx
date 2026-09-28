import { fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { initI18n } from '@/i18n';
import type { ServiceLocation } from '@/types/domain';
import { regionForRadius } from '@/utils/geo';

import { emitMapMessage, getMapWebView, injectedMapMessages } from '../../__test-utils__/map-bridge';
import { webViewMock } from '../../__test-utils__/react-native-webview.mock';
import { renderWithProviders } from '../../__test-utils__/render';
import { regionToBounds } from '../../map/leaflet/map-geometry';
import type { MapPageState } from '../../map/leaflet/map-protocol';
import { AppText } from '../../ui/app-text';
import { LocationPicker } from '../location-picker';

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

const lastPin = () => (injectedMapMessages().filter((message) => message.type === 'state').pop()?.state as MapPageState | undefined)?.pin;

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

  beforeEach(() => {
    webViewMock.injectJavaScript.mockClear();
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
    const map = getMapWebView();
    await emitMapMessage(map, { type: 'ready' });
    await emitMapMessage(map, { type: 'mapPress', coordinate: { latitude: 32.0801, longitude: 34.7801 } });
    expect(await screen.findByDisplayValue('Ibn Gabirol St 50')).toBeOnTheScreen();
    expect(screen.getByTestId('picked')).toHaveTextContent('Ibn Gabirol St 50|Tel Aviv-Yafo|32.0801');
  });

  it('moves the map to a picked suggestion and puts the pin there', async () => {
    await renderWithProviders(<Harness />);
    await emitMapMessage(getMapWebView(), { type: 'ready' });
    expect(lastPin()).toBeNull();

    const search = screen.getByTestId('location-search');
    await fireEvent(search, 'focus');
    await fireEvent.changeText(search, 'Dizen');
    await fireEvent.press(await screen.findByRole('button', { name: 'Dizengoff St 120, Center, Tel Aviv-Yafo' }));
    const animation = injectedMapMessages().find((message) => message.type === 'animateToRegion');
    expect(animation?.bounds).toEqual(regionToBounds(regionForRadius({ latitude: 32.08, longitude: 34.77 }, 0.45)));
    expect(lastPin()).toMatchObject({ latitude: 32.08, longitude: 34.77 });
  });

  it('moves the map again when the same place is picked after panning away', async () => {
    await renderWithProviders(<Harness />);
    const map = getMapWebView();
    await emitMapMessage(map, { type: 'ready' });
    const search = screen.getByTestId('location-search');
    const pick = async () => {
      await fireEvent(search, 'focus');
      await fireEvent.changeText(search, 'Dizen');
      await fireEvent.press(await screen.findByRole('button', { name: 'Dizengoff St 120, Center, Tel Aviv-Yafo' }));
    };
    await pick();
    // The user pans somewhere else, then picks the same address again.
    await emitMapMessage(map, { type: 'regionChange', bounds: [[31.9, 34.6], [32.0, 34.7]] });
    await pick();
    const target = regionToBounds(regionForRadius({ latitude: 32.08, longitude: 34.77 }, 0.45));
    const animations = injectedMapMessages().filter((message) => message.type === 'animateToRegion');
    expect(animations.map((message) => message.bounds)).toEqual([target, target]);
  });

  it('fine-tunes the address by dragging the pin, keeping the apartment details', async () => {
    await renderWithProviders(<Harness initial={SAVED_ADDRESS} />);
    const map = getMapWebView();
    await emitMapMessage(map, { type: 'ready' });
    expect(lastPin()).toMatchObject({ latitude: 32.082, longitude: 34.813 });

    await emitMapMessage(map, { type: 'pinDragEnd', coordinate: { latitude: 32.0801, longitude: 34.7801 } });
    expect(await screen.findByDisplayValue('Ibn Gabirol St 50')).toBeOnTheScreen();
    expect(screen.getByTestId('picked')).toHaveTextContent('Ibn Gabirol St 50|Tel Aviv-Yafo|32.0801');
    expect(screen.getByTestId('picked-details')).toHaveTextContent('Building B, 4th floor');
    expect(lastPin()).toMatchObject({ latitude: 32.0801, longitude: 34.7801 });
  });

  it('zooms with its own buttons once the map is ready', async () => {
    await renderWithProviders(<Harness initial={SAVED_ADDRESS} />);
    expect(screen.queryByRole('button', { name: 'Zoom in' })).toBeNull();
    await emitMapMessage(getMapWebView(), { type: 'ready' });
    await fireEvent.press(screen.getByRole('button', { name: 'Zoom in' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Zoom out' }));
    expect(injectedMapMessages().map((message) => message.type)).toEqual(expect.arrayContaining(['zoomIn', 'zoomOut']));
  });

  it('explains a blocked location permission with a settings shortcut', async () => {
    await renderWithProviders(<Harness />);
    await fireEvent.press(screen.getByRole('button', { name: 'Use my current location' }));
    expect(await screen.findByText('Location access is blocked')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Open settings' })).toBeOnTheScreen();
  });
});
