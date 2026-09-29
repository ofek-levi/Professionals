import { act, fireEvent, screen } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Platform } from 'react-native';

import { renderWithProviders } from '@/components/__test-utils__/render';
import { initI18n } from '@/i18n';
import type { RequestFormPhoto } from '@/lib/validation';

import { PhotosField } from '../photos-field';

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(async () => ({
    canceled: false,
    assets: [{ uri: 'file:///picked.jpg', width: 800, height: 600, mimeType: 'image/jpeg', fileName: 'picked.jpg' }],
  })),
  launchCameraAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
}));

function Harness() {
  const [photos, setPhotos] = useState<RequestFormPhoto[]>([]);
  return <PhotosField value={photos} onChange={setPhotos} />;
}

describe('PhotosField', () => {
  beforeAll(async () => {
    await initI18n('en');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockClear();
  });

  it('opens the photo library once the source sheet has closed (Android)', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    await renderWithProviders(<Harness />);
    await fireEvent.press(screen.getByTestId('request-form-add-photos'));
    await fireEvent.press(screen.getByRole('button', { name: 'Choose from library' }));

    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('imagebutton', { name: 'Open photo 1 of 1' })).toBeOnTheScreen();
  });

  it('waits for iOS to dismiss the sheet before presenting the picker', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    await renderWithProviders(<Harness />);
    await fireEvent.press(screen.getByTestId('request-form-add-photos'));
    const modal = screen.getByTestId('photo-source-sheet');
    await fireEvent.press(screen.getByRole('button', { name: 'Choose from library' }));
    expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();

    // The Modal reports the end of the native dismissal.
    await act(() => modal.props.onDismiss());
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledTimes(1);
  });
});
