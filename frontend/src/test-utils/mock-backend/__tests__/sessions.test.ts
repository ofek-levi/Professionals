/**
 * Sessions, tokens, `/me` and push tokens of the double follow the backend contract
 * (backend/docs/API.md → Auth → Tokens and sessions, Users).
 */
import { MAIN_CUSTOMER_IDS, PRO_IDS } from '../data/seed';
import { SEED_CUSTOMER_EMAIL, SEED_PASSWORD } from '../server/passwords';
import { createTestEnvironment, expectApiError, type TestEnvironment } from '../testing/test-server';

const NOA = MAIN_CUSTOMER_IDS.noa;

let env: TestEnvironment;
const auth = () => env.as(null).auth;
const db = () => env.server.internals.db;
/** The push tokens stored on sessions (at most one per session, like the backend). */
const pushTokens = () => db().sessions.all().flatMap(({ userId, pushToken }) => (pushToken ? [{ userId, pushToken }] : []));

beforeEach(() => {
  env = createTestEnvironment();
});

/** `GET /me` with an explicit access token. */
const meWith = (accessToken: string) =>
  env.transport({ method: 'GET', path: '/me', headers: { Authorization: `Bearer ${accessToken}` } });

describe('access tokens', () => {
  it('are valid for 30 minutes of server time', async () => {
    const session = await auth().login({ email: SEED_CUSTOMER_EMAIL, password: SEED_PASSWORD });
    expect(Date.parse(session.accessTokenExpiresAt) - env.clock.now().getTime()).toBe(30 * 60_000);
    expect(await meWith(session.accessToken)).toMatchObject({ status: 200 });
    env.clock.advanceMinutes(29);
    expect(await meWith(session.accessToken)).toMatchObject({ status: 200 });
    env.clock.advanceMinutes(1);
    expect(await meWith(session.accessToken)).toMatchObject({ status: 401, data: { code: 'UNAUTHORIZED' } });
  });

  it('refuses forged or tampered tokens', async () => {
    const session = await auth().login({ email: SEED_CUSTOMER_EMAIL, password: SEED_PASSWORD });
    const [kind, sessionId, expiresAt] = session.accessToken.split('.');
    expect(await meWith(`${kind}.${sessionId}.${Number(expiresAt) + 60_000}.0000000000000000`)).toMatchObject({ status: 401 });
    expect(await meWith('garbage')).toMatchObject({ status: 401 });
  });
});

describe('POST /auth/refresh', () => {
  it('rotates the refresh token and issues a new access token', async () => {
    const session = await auth().login({ email: SEED_CUSTOMER_EMAIL, password: SEED_PASSWORD });
    env.clock.advanceMinutes(25);
    const next = await auth().refresh({ refreshToken: session.refreshToken });
    expect(next).toEqual({
      accessToken: expect.stringMatching(/^access\./),
      accessTokenExpiresAt: new Date(env.clock.now().getTime() + 30 * 60_000).toISOString(),
      refreshToken: expect.stringMatching(/^refresh\./),
    });
    expect(next.refreshToken).not.toBe(session.refreshToken);
    expect(next).not.toHaveProperty('user');
    expect(await meWith(next.accessToken)).toMatchObject({ status: 200 });
    // The refresh is anonymous: no bearer token is sent.
    expect(env.log.to('/auth/refresh')[0].headers.Authorization).toBeUndefined();
  });

  it('answers a replay of the just-replaced token within 30 s with the same new token', async () => {
    const session = await auth().login({ email: SEED_CUSTOMER_EMAIL, password: SEED_PASSWORD });
    const first = await auth().refresh({ refreshToken: session.refreshToken });
    env.clock.advanceMinutes(0.25);
    const replay = await auth().refresh({ refreshToken: session.refreshToken });
    expect(replay.refreshToken).toBe(first.refreshToken);
    // Both parties now hold the same token, which keeps working.
    await expect(auth().refresh({ refreshToken: first.refreshToken })).resolves.toMatchObject({ refreshToken: expect.any(String) });
  });

  it('revokes the whole session (and its push token) when an older token is reused', async () => {
    const session = await auth().login({ email: SEED_CUSTOMER_EMAIL, password: SEED_PASSWORD });
    await env.transport({
      method: 'POST',
      path: '/me/devices',
      body: { pushToken: 'ExponentPushToken[noa-phone]', platform: 'android' },
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    const first = await auth().refresh({ refreshToken: session.refreshToken });
    env.clock.advanceMinutes(1); // past the replay window
    expect(await expectApiError(auth().refresh({ refreshToken: session.refreshToken }))).toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
    });
    // The thief and the owner are both out: the current token and access token stop working.
    expect(await expectApiError(auth().refresh({ refreshToken: first.refreshToken }))).toMatchObject({ status: 401 });
    expect(await meWith(first.accessToken)).toMatchObject({ status: 401 });
    expect(pushTokens()).toEqual([]);
  });

  it('refuses a missing, unknown or forged token without revoking anything', async () => {
    const session = await auth().login({ email: SEED_CUSTOMER_EMAIL, password: SEED_PASSWORD });
    const sessionId = session.refreshToken.split('.')[1];
    expect(await expectApiError(auth().refresh({ refreshToken: '' }))).toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });
    expect(await expectApiError(auth().refresh({ refreshToken: 'nope' }))).toMatchObject({ status: 401 });
    expect(await expectApiError(auth().refresh({ refreshToken: `refresh.${sessionId}.7.forged` }))).toMatchObject({ status: 401 });
    await expect(auth().refresh({ refreshToken: session.refreshToken })).resolves.toBeDefined();
  });
});

describe('POST /auth/logout', () => {
  it('ends the session of the refresh token and removes only its push token', async () => {
    const phone = await auth().login({ email: SEED_CUSTOMER_EMAIL, password: SEED_PASSWORD });
    const tablet = await auth().login({ email: SEED_CUSTOMER_EMAIL, password: SEED_PASSWORD });
    const register = (accessToken: string, pushToken: string) =>
      env.transport({
        method: 'POST',
        path: '/me/devices',
        body: { pushToken, platform: 'ios' },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    await register(phone.accessToken, 'ExponentPushToken[phone]');
    await register(tablet.accessToken, 'ExponentPushToken[tablet]');

    await expect(auth().logout({ refreshToken: phone.refreshToken })).resolves.toEqual({ success: true });
    expect(await meWith(phone.accessToken)).toMatchObject({ status: 401 });
    expect(await expectApiError(auth().refresh({ refreshToken: phone.refreshToken }))).toMatchObject({ status: 401 });
    expect(pushTokens().map(({ pushToken }) => pushToken)).toEqual(['ExponentPushToken[tablet]']);
    // The other sign-in is untouched; logging out twice is fine.
    expect(await meWith(tablet.accessToken)).toMatchObject({ status: 200 });
    await expect(auth().logout({ refreshToken: phone.refreshToken })).resolves.toEqual({ success: true });
  });

  it('falls back to the bearer token’s session and never fails', async () => {
    const session = await auth().login({ email: SEED_CUSTOMER_EMAIL, password: SEED_PASSWORD });
    const response = await env.transport({
      method: 'POST',
      path: '/auth/logout',
      body: {},
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    expect(response).toEqual({ status: 200, data: { success: true } });
    expect(await meWith(session.accessToken)).toMatchObject({ status: 401 });
    expect(await env.transport({ method: 'POST', path: '/auth/logout', body: { refreshToken: 'garbage' }, headers: {} })).toMatchObject({
      status: 200,
    });
  });
});

describe('/me', () => {
  it('PATCH /me stores the account language', async () => {
    const me = await env.as(NOA).users.updateMe({ preferredLanguage: 'he' });
    expect(me.user).toMatchObject({ id: NOA, preferredLanguage: 'he' });
    expect((await env.as(NOA).users.getCurrentUser()).user.preferredLanguage).toBe('he');
    const invalid = await expectApiError(env.as(NOA).users.updateMe({ preferredLanguage: 'fr' as 'en' }));
    expect(invalid).toMatchObject({ status: 400, fieldErrors: { preferredLanguage: ['validation:invalid'] } });
  });

  it('keeps one Expo push token per session, and moves a token to the account that registers it', async () => {
    await expect(env.as(NOA).users.registerDevice({ pushToken: 'ExponentPushToken[shared]', platform: 'ios' })).resolves.toEqual({
      success: true,
    });
    const notExpo = await expectApiError(env.as(NOA).users.registerDevice({ pushToken: 'simulated:abc', platform: 'ios' }));
    expect(notExpo).toMatchObject({ status: 400, fieldErrors: { pushToken: ['validation:invalid'] } });
    expect(await expectApiError(env.as(NOA).users.registerDevice({ pushToken: 'ExpoPushToken[x]', platform: 'desktop' as 'ios' }))).toMatchObject({
      status: 400,
      fieldErrors: { platform: ['validation:invalid'] },
    });
    expect(pushTokens()).toEqual([{ userId: NOA, pushToken: 'ExponentPushToken[shared]' }]);
    // Another account signs in on the same phone.
    await env.as(PRO_IDS.avi).users.registerDevice({ pushToken: 'ExponentPushToken[shared]', platform: 'ios' });
    expect(pushTokens()).toEqual([{ userId: PRO_IDS.avi, pushToken: 'ExponentPushToken[shared]' }]);
    // Removing is idempotent and never touches another account's token.
    await expect(env.as(NOA).users.unregisterDevice('ExponentPushToken[shared]')).resolves.toEqual({ success: true });
    expect(pushTokens()).toHaveLength(1);
    // A new token from the OS replaces the session's old one.
    await env.as(PRO_IDS.avi).users.registerDevice({ pushToken: 'ExponentPushToken[rotated]', platform: 'android' });
    expect(pushTokens()).toEqual([{ userId: PRO_IDS.avi, pushToken: 'ExponentPushToken[rotated]' }]);
    await expect(env.as(PRO_IDS.avi).users.unregisterDevice('ExponentPushToken[rotated]')).resolves.toEqual({ success: true });
    expect(pushTokens()).toEqual([]);
    expect(env.log.to('/me/devices/ExponentPushToken%5Bshared%5D', 'DELETE')).toHaveLength(1);
  });
});
