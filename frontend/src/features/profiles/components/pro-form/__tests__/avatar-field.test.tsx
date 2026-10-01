/**
 * The profile photo's actions against the backend test double: set (`PUT /me/avatar`), remove after
 * a confirmation (`DELETE /me/avatar`), the success toasts (en + he), the photo toast when the API
 * refuses the photo or the photo service is down, and both buttons disabled while one runs.
 */
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import type { ReactNode } from 'react';

import { renderWithProviders } from '@/components/__test-utils__/render';
import { DialogProvider, OverlayHostProvider, ToastProvider } from '@/components/ui';
import { i18n, initI18n } from '@/i18n';
import { apiClient } from '@/services/api';
import type { TransportRequest, TransportResponse } from '@/services/api/transport';
import { sessionStore } from '@/services/auth/session-store';
import { PRO_IDS } from '@/test-utils/mock-backend/data/seed';
import { createTestEnvironment, type TestEnvironment } from '@/test-utils/mock-backend/testing/test-server';

import { AvatarField } from '../avatar-field';

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(async () => ({
    canceled: false,
    assets: [{ uri: 'file:///me.jpg', width: 800, height: 800, mimeType: 'image/jpeg', fileName: 'me.jpg', fileSize: 4096 }],
  })),
  requestMediaLibraryPermissionsAsync: jest.fn(),
}));

let env: TestEnvironment;
/** The next `PUT /me/avatar` waits for `release` and then answers `response` (or the double). */
let held: { release: Promise<void>; response?: TransportResponse } | null = null;

beforeAll(async () => {
  await initI18n('en');
  env = createTestEnvironment({ now: new Date() });
  apiClient.setTransport(async (request: TransportRequest) => {
    if (request.method === 'PUT' && request.path === '/me/avatar' && held) {
      const { release, response } = held;
      held = null;
      await release;
      if (response) return response;
    }
    return env.transport(request);
  });
});

beforeEach(async () => {
  await sessionStore.signIn(env.signIn(PRO_IDS.avi));
});

afterEach(async () => {
  held = null;
  await sessionStore.signOut();
  await i18n.changeLanguage('en');
});

function Overlays({ children }: { children: ReactNode }) {
  return (
    <OverlayHostProvider>
      <DialogProvider>
        <ToastProvider>{children}</ToastProvider>
      </DialogProvider>
    </OverlayHostProvider>
  );
}

const renderField = (value: string | null) =>
  renderWithProviders(
    <Overlays>
      <AvatarField name="Avi Levi" value={value} />
    </Overlays>,
  );

/** Holds the next photo upload until the returned function is called. */
function holdUpload(response?: TransportResponse): () => void {
  let release!: () => void;
  held = { release: new Promise<void>((resolve) => (release = resolve)), response };
  return release;
}

describe('AvatarField', () => {
  it('uploads the picked photo, with both buttons disabled meanwhile, and says so', async () => {
    await renderField('https://images.test/old.jpg');
    const release = holdUpload();
    await fireEvent.press(screen.getByTestId('pro-form-change-photo'));
    await waitFor(() => expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('pro-form-change-photo')).toBeDisabled());
    expect(screen.getByTestId('pro-form-remove-photo')).toBeDisabled();

    await act(async () => release());
    expect(await screen.findByText('Profile photo updated')).toBeOnTheScreen();
    expect(screen.getByTestId('pro-form-remove-photo')).toBeEnabled();
    expect(env.log.to('/me/avatar', 'PUT')).not.toHaveLength(0);
  });

  it('removes the photo after a confirmation (in Hebrew too)', async () => {
    await i18n.changeLanguage('he');
    await renderField('https://images.test/old.jpg');
    await fireEvent.press(screen.getByTestId('pro-form-remove-photo'));
    expect(await screen.findByText('להסיר את תמונת הפרופיל?')).toBeOnTheScreen();
    await fireEvent.press(screen.getAllByRole('button', { name: 'הסרה' }).at(-1)!);
    expect(await screen.findByText('תמונת הפרופיל הוסרה')).toBeOnTheScreen();
    expect(env.log.to('/me/avatar', 'DELETE')).not.toHaveLength(0);
  });

  it.each([
    [413, { code: 'VALIDATION_ERROR', message: 'Too large', fieldErrors: { avatar: ['validation:upload.invalid'] } }, 'This photo can’t be used'],
    [503, { code: 'SERVER_ERROR', message: 'Down', fieldErrors: { avatar: ['validation:upload.unavailable'] } }, 'Photos can’t be uploaded right now'],
    [429, { code: 'RATE_LIMITED', message: 'Busy', fieldErrors: { avatar: ['validation:upload.rateLimited'] } }, 'Too many photos for now'],
  ])('explains a refused upload (%i) with the photo toast', async (status, data, title) => {
    await renderField(null);
    const release = holdUpload({ status, data });
    await fireEvent.press(screen.getByTestId('pro-form-change-photo'));
    await act(async () => release());
    expect(await screen.findByText(title)).toBeOnTheScreen();
    expect(screen.getByTestId('pro-form-change-photo')).toBeEnabled();
  });
});
