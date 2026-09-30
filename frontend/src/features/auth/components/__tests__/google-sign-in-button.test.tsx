/**
 * "Continue with Google" exists only where Google sign-in can really work (a client id for this
 * platform): otherwise nothing is rendered, no stand-in. When shown, it hands Google's id token on
 * and reports a failed Google prompt.
 */
import { fireEvent, renderHook, screen, waitFor } from '@testing-library/react-native';

import { renderWithProviders } from '@/components/__test-utils__/render';
import { ToastProvider } from '@/components/ui';
import { initI18n } from '@/i18n';
import type { RealGoogleIdToken } from '@/services/auth/use-real-google-id-token';

import { GoogleSignInButton, useGoogleSignInAvailable } from '../google-sign-in-button';

const mockGoogle: RealGoogleIdToken = { isAvailable: false, isReady: false, prompt: async () => null };
jest.mock('@/services/auth/use-real-google-id-token', () => ({ useRealGoogleIdToken: () => mockGoogle }));

beforeAll(async () => {
  await initI18n('en');
});

async function renderButton(onIdToken = jest.fn()) {
  await renderWithProviders(
    <ToastProvider>
      <GoogleSignInButton onIdToken={onIdToken} testID="google" />
    </ToastProvider>,
  );
  return onIdToken;
}

describe('GoogleSignInButton', () => {
  it('renders nothing without a Google client id for the platform (the test build has none)', async () => {
    Object.assign(mockGoogle, { isAvailable: false, isReady: false });
    await renderButton();
    expect(screen.queryByTestId('google')).toBeNull();
    expect(screen.queryByText(/google/i)).toBeNull();
    // What the screens ask before showing the button and the "or" divider.
    const { result } = await renderHook(() => useGoogleSignInAvailable());
    expect(result.current).toBe(false);
  });

  it('passes Google’s id token on when configured', async () => {
    Object.assign(mockGoogle, { isAvailable: true, isReady: true, prompt: jest.fn(async () => 'google-id-token') });
    const onIdToken = await renderButton();
    expect(screen.getByTestId('google')).toHaveTextContent('Continue with Google');
    await fireEvent.press(screen.getByTestId('google'));
    await waitFor(() => expect(onIdToken).toHaveBeenCalledWith('google-id-token'));
  });

  it('does nothing when the user closes Google’s sign-in, and reports a failed prompt', async () => {
    Object.assign(mockGoogle, { isAvailable: true, isReady: true, prompt: jest.fn(async () => null) });
    const onIdToken = await renderButton();
    await fireEvent.press(screen.getByTestId('google'));
    await waitFor(() => expect(mockGoogle.prompt).toHaveBeenCalled());
    expect(onIdToken).not.toHaveBeenCalled();

    Object.assign(mockGoogle, { prompt: jest.fn(async () => Promise.reject(new Error('popup blocked'))) });
    await fireEvent.press(screen.getByTestId('google'));
    expect(await screen.findByText('Google sign-in didn’t open')).toBeOnTheScreen();
    expect(onIdToken).not.toHaveBeenCalled();
  });
});
