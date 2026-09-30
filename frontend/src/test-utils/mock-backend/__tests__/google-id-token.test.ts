import { base64UrlEncodeText } from '../server/encoding';

import {
  buildMockGoogleIdToken,
  decodeUnverifiedGoogleJwt,
  googleProfileFromClaims,
  isMockGoogleIdToken,
  mockGoogleSubject,
  parseMockGoogleIdToken,
} from '../server/google-id-token';

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
