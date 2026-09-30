import { renderHook } from '@testing-library/react-native';

import { googleAuthConfig, resolveGoogleAuthConfig } from '../google-auth';
import { useRealGoogleIdToken } from '../use-real-google-id-token';

const ids = { webClientId: 'web.apps.googleusercontent.com', iosClientId: null, androidClientId: 'android.apps.googleusercontent.com' };

describe('Google auth configuration', () => {
  it('offers Google sign-in only when the platform has a client id (and not in Expo Go on native)', () => {
    expect(resolveGoogleAuthConfig(ids, 'web', false)).toMatchObject({ available: true, platformClientId: ids.webClientId, unavailableReason: null });
    expect(resolveGoogleAuthConfig(ids, 'android', false)).toMatchObject({ available: true, platformClientId: ids.androidClientId });
    expect(resolveGoogleAuthConfig(ids, 'ios', false)).toMatchObject({ available: false, unavailableReason: 'not_configured' });
    expect(resolveGoogleAuthConfig(ids, 'android', true)).toMatchObject({ available: false, unavailableReason: 'expo_go' });
    expect(resolveGoogleAuthConfig(ids, 'web', true)).toMatchObject({ available: true });
  });

  it('is unavailable when nothing is configured (tests)', () => {
    expect(googleAuthConfig.available).toBe(false);
  });

  it('provides an inert real-Google hook when not configured', async () => {
    const { result } = await renderHook(() => useRealGoogleIdToken());
    expect(result.current.isAvailable).toBe(false);
    expect(result.current.isReady).toBe(false);
    await expect(result.current.prompt()).resolves.toBeNull();
  });
});
