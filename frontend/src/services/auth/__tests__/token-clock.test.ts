/**
 * A device clock running ahead of the server must not make fresh access tokens look expired (the
 * finding: +45 min made the app refresh before every request, then hit 429).
 */
import { createTokenManager } from '../token-manager';
import { accessTokenLifetimeMs, onDeviceClock } from '../token-clock';

const SERVER_NOW = Date.parse('2026-09-30T10:00:00.000Z');
const DEVICE_AHEAD = SERVER_NOW + 45 * 60_000;

function base64Url(value: object): string {
  return btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** A JWT as the API issues it: 30 minutes from `iat` (server clock). */
function jwt(iatMs = SERVER_NOW, lifetimeS = 1800): string {
  const iat = Math.floor(iatMs / 1000);
  return `${base64Url({ alg: 'HS256', typ: 'JWT' })}.${base64Url({ sub: 'u1', iat, exp: iat + lifetimeS })}.signature`;
}

const serverTokens = (accessToken = jwt()) => ({
  accessToken,
  accessTokenExpiresAt: new Date(SERVER_NOW + 30 * 60_000).toISOString(),
  refreshToken: 'refresh-1',
});

describe('token clock', () => {
  it('reads the lifetime of a JWT access token (exp - iat)', () => {
    expect(accessTokenLifetimeMs(jwt())).toBe(30 * 60_000);
    expect(accessTokenLifetimeMs(jwt(SERVER_NOW, 90))).toBe(90_000);
    for (const opaque of ['access-1', 'a.b.c', 'access.sess_1.123.sig', '']) expect(accessTokenLifetimeMs(opaque)).toBeNull();
  });

  it('re-bases the expiry on the device clock when the tokens arrive', () => {
    expect(onDeviceClock(serverTokens(), DEVICE_AHEAD).accessTokenExpiresAt).toBe(new Date(DEVICE_AHEAD + 30 * 60_000).toISOString());
    // Opaque tokens keep the server's expiry.
    const opaque = serverTokens('access-1');
    expect(onDeviceClock(opaque, DEVICE_AHEAD)).toBe(opaque);
  });

  it('does not refresh a fresh token on a device 45 minutes ahead, and refreshes it when it is due', async () => {
    let tokens = onDeviceClock(serverTokens(), DEVICE_AHEAD);
    let now = DEVICE_AHEAD;
    const refresh = jest.fn(async () => serverTokens(jwt(SERVER_NOW + 29 * 60_000)));
    const manager = createTokenManager({
      store: {
        getTokens: () => tokens,
        reloadTokens: async () => tokens,
        updateTokens: async (next) => {
          tokens = onDeviceClock(next, now);
        },
        signOut: async () => undefined,
      },
      refresh,
      now: () => now,
    });

    for (let i = 0; i < 6; i += 1) await expect(manager.getAccessToken()).resolves.toBe(tokens.accessToken);
    expect(refresh).not.toHaveBeenCalled();

    now += 29.5 * 60_000; // within the leeway of the device-clock expiry
    await manager.getAccessToken();
    expect(refresh).toHaveBeenCalledTimes(1);
    await manager.getAccessToken();
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
