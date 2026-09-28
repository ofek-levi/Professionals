import { renderHook } from '@testing-library/react-native';

import { base64UrlEncodeText } from '@/utils/encoding';

import { googleAuthConfig, resolveGoogleAuthConfig, SIMULATED_GOOGLE_ACCOUNTS } from '../google-auth';
import {
  buildMockGoogleIdToken,
  decodeUnverifiedGoogleJwt,
  googleProfileFromClaims,
  isMockGoogleIdToken,
  mockGoogleSubject,
  parseMockGoogleIdToken,
} from '../google-id-token';
import { useRealGoogleIdToken } from '../use-real-google-id-token';

const ids = { webClientId: 'web.apps.googleusercontent.com', iosClientId: null, androidClientId: 'android.apps.googleusercontent.com' };

describe('Google auth configuration', () => {
  it('uses real Google sign-in only when the platform has a client id (and not in Expo Go on native)', () => {
    expect(resolveGoogleAuthConfig(ids, 'web', false)).toMatchObject({ mode: 'google', platformClientId: ids.webClientId, simulationReason: null });
    expect(resolveGoogleAuthConfig(ids, 'android', false)).toMatchObject({ mode: 'google', platformClientId: ids.androidClientId });
    expect(resolveGoogleAuthConfig(ids, 'ios', false)).toMatchObject({ mode: 'simulated', simulationReason: 'not_configured' });
    expect(resolveGoogleAuthConfig(ids, 'android', true)).toMatchObject({ mode: 'simulated', simulationReason: 'expo_go' });
    expect(resolveGoogleAuthConfig(ids, 'web', true)).toMatchObject({ mode: 'google' });
  });

  it('simulates Google sign-in when nothing is configured (tests, demo)', () => {
    expect(googleAuthConfig.mode).toBe('simulated');
  });

  it('offers one new identity and existing demo identities in the simulated sheet', () => {
    expect(SIMULATED_GOOGLE_ACCOUNTS.filter((account) => account.kind === 'new').map((account) => account.email)).toEqual(['maya.katz@gmail.com']);
    expect(SIMULATED_GOOGLE_ACCOUNTS.filter((account) => account.kind === 'existing').length).toBeGreaterThanOrEqual(2);
    expect(new Set(SIMULATED_GOOGLE_ACCOUNTS.map((account) => account.id)).size).toBe(SIMULATED_GOOGLE_ACCOUNTS.length);
  });

  it('provides an inert real-Google hook when not configured', async () => {
    const { result } = await renderHook(() => useRealGoogleIdToken());
    expect(result.current.isAvailable).toBe(false);
    expect(result.current.isReady).toBe(false);
    await expect(result.current.prompt()).resolves.toBeNull();
  });
});

describe('mock Google id tokens', () => {
  it('round-trips an identity (including Hebrew names)', () => {
    const token = buildMockGoogleIdToken({ email: ' Maya.Katz@Gmail.com ', firstName: 'מאיה', lastName: 'כץ', avatarUrl: null });
    expect(token.startsWith('mock-google.')).toBe(true);
    expect(isMockGoogleIdToken(token)).toBe(true);
    const claims = parseMockGoogleIdToken(token);
    expect(claims).toEqual({
      sub: mockGoogleSubject('maya.katz@gmail.com'),
      email: 'maya.katz@gmail.com',
      given_name: 'מאיה',
      family_name: 'כץ',
      picture: null,
    });
    expect(googleProfileFromClaims(claims!)).toEqual({ email: 'maya.katz@gmail.com', firstName: 'מאיה', lastName: 'כץ', avatarUrl: null });
  });

  it('derives a stable subject per email', () => {
    expect(mockGoogleSubject('A@b.co')).toBe(mockGoogleSubject('a@b.co'));
    expect(mockGoogleSubject('a@b.co')).not.toBe(mockGoogleSubject('c@b.co'));
  });

  it('rejects malformed tokens', () => {
    expect(parseMockGoogleIdToken('eyJ.x.y')).toBeNull();
    expect(parseMockGoogleIdToken('mock-google.')).toBeNull();
    expect(parseMockGoogleIdToken(`mock-google.${base64UrlEncodeText('[1,2]')}`)).toBeNull();
    expect(parseMockGoogleIdToken(`mock-google.${base64UrlEncodeText(JSON.stringify({ sub: '', email: 'a@b.co' }))}`)).toBeNull();
  });

  it('decodes a real-looking Google JWT only when issuer, audience, expiry and verified email check out', () => {
    const now = new Date('2026-09-27T07:00:00.000Z');
    const exp = now.getTime() / 1000 + 60;
    const audiences = ['web-client.apps.googleusercontent.com', 'ios-client.apps.googleusercontent.com'];
    const jwt = (payload: object) => `${base64UrlEncodeText('{}')}.${base64UrlEncodeText(JSON.stringify(payload))}.sig`;
    const valid = {
      iss: 'accounts.google.com',
      aud: 'web-client.apps.googleusercontent.com',
      sub: '42',
      email: 'X@gmail.com',
      email_verified: true,
      exp,
      given_name: 'X',
      picture: 'https://p',
    };
    const decode = (token: string) => decodeUnverifiedGoogleJwt(token, now, audiences);
    expect(decode(jwt(valid))).toEqual({ sub: '42', email: 'x@gmail.com', given_name: 'X', family_name: '', picture: 'https://p' });
    expect(decode(jwt({ ...valid, aud: ['other-app', 'ios-client.apps.googleusercontent.com'] }))).not.toBeNull();
    expect(decode(jwt({ ...valid, exp: exp - 120 }))).toBeNull();
    expect(decode(jwt({ ...valid, iss: 'other' }))).toBeNull();
    expect(decode(jwt({ ...valid, email_verified: false }))).toBeNull();
    // Minted for another app, or no audience at all.
    expect(decode(jwt({ ...valid, aud: 'someone-elses-client.apps.googleusercontent.com' }))).toBeNull();
    expect(decode(jwt({ ...valid, aud: undefined }))).toBeNull();
    // Without configured client ids no real token is accepted.
    expect(decodeUnverifiedGoogleJwt(jwt(valid), now, [])).toBeNull();
    expect(decode('a.b')).toBeNull();
  });
});
