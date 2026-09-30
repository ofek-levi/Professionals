/**
 * Device registration for push against the backend test double: `POST /me/devices
 * { pushToken, platform }` after permission, again when the OS issues a new token,
 * `DELETE /me/devices/:token` when push is turned off; nothing on the web.
 */
import { MAIN_CUSTOMER_IDS } from '@/test-utils/mock-backend/data/seed';
import { createTestEnvironment, type TestEnvironment } from '@/test-utils/mock-backend/testing/test-server';

import { createPushRegistration } from '../push-registration';
import type { PushPermissionStatus, PushProvider } from '../types';
import { createUnsupportedPushProvider } from '../unsupported-push-provider';

const NOA = MAIN_CUSTOMER_IDS.noa;

function fakeProvider(options: { permission?: PushPermissionStatus; afterPrompt?: PushPermissionStatus; token?: string | null } = {}) {
  let permission = options.permission ?? 'undetermined';
  let token = options.token === undefined ? 'ExponentPushToken[device-1]' : options.token;
  const tokenListeners = new Set<() => void>();
  const provider: PushProvider = {
    isSupported: true,
    platform: 'android',
    getPermissionStatus: jest.fn(async () => permission),
    requestPermission: jest.fn(async () => {
      permission = options.afterPrompt ?? 'granted';
      return permission;
    }),
    getPushToken: jest.fn(async () => token),
    onTokenChange: (listener) => {
      tokenListeners.add(listener);
      return () => tokenListeners.delete(listener);
    },
    onTap: () => () => undefined,
  };
  return {
    provider,
    /** The OS rotated the device token. */
    rotateToken(next: string) {
      token = next;
      tokenListeners.forEach((listener) => listener());
    },
    listenerCount: () => tokenListeners.size,
  };
}

function registrationFor(env: TestEnvironment, provider: PushProvider) {
  const api = env.as(NOA);
  return createPushRegistration({
    provider,
    register: (payload) => api.users.registerDevice(payload),
    unregister: (pushToken) => api.users.unregisterDevice(pushToken),
  });
}

const devices = (env: TestEnvironment) =>
  env.server.internals.db.devices.all().map(({ userId, pushToken, platform }) => ({ userId, pushToken, platform }));
const flush = async () => {
  for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setImmediate(resolve));
};

describe('push registration', () => {
  it('asks for permission when allowed to, then registers the Expo token for the session', async () => {
    const env = createTestEnvironment();
    const { provider } = fakeProvider();
    await expect(registrationFor(env, provider).register({ askPermission: true })).resolves.toBe('registered');
    expect(provider.requestPermission).toHaveBeenCalledTimes(1);
    expect(env.log.to('/me/devices', 'POST').map((request) => request.body)).toEqual([
      { pushToken: 'ExponentPushToken[device-1]', platform: 'android' },
    ]);
    expect(devices(env)).toEqual([{ userId: NOA, pushToken: 'ExponentPushToken[device-1]', platform: 'android' }]);
  });

  it('never prompts when not allowed to, and does not register without permission', async () => {
    const env = createTestEnvironment();
    const undetermined = fakeProvider();
    await expect(registrationFor(env, undetermined.provider).register({ askPermission: false })).resolves.toBe('undetermined');
    expect(undetermined.provider.requestPermission).not.toHaveBeenCalled();

    const denied = fakeProvider({ afterPrompt: 'denied' });
    await expect(registrationFor(env, denied.provider).register({ askPermission: true })).resolves.toBe('denied');
    const blocked = fakeProvider({ permission: 'denied' });
    await expect(registrationFor(env, blocked.provider).register({ askPermission: true })).resolves.toBe('denied');
    expect(blocked.provider.requestPermission).not.toHaveBeenCalled();
    expect(env.log.to('/me/devices')).toHaveLength(0);
  });

  it('reports a missing token (simulator, no FCM config) or a refused registration without throwing', async () => {
    const env = createTestEnvironment();
    const noToken = fakeProvider({ permission: 'granted', token: null });
    await expect(registrationFor(env, noToken.provider).register({ askPermission: true })).resolves.toBe('failed');

    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const notExpo = fakeProvider({ permission: 'granted', token: 'simulated:not-an-expo-token' });
    await expect(registrationFor(env, notExpo.provider).register({ askPermission: true })).resolves.toBe('failed');
    expect(env.log.to('/me/devices')[0].status).toBe(400);
    warn.mockRestore();
    expect(devices(env)).toEqual([]);
  });

  it('registers again when the OS issues a new token, until stopped', async () => {
    const env = createTestEnvironment();
    const device = fakeProvider({ permission: 'granted' });
    const stop = registrationFor(env, device.provider).start({ askPermission: true });
    await flush();
    device.rotateToken('ExponentPushToken[device-2]');
    await flush();
    expect(env.log.to('/me/devices', 'POST').map((request) => (request.body as { pushToken: string }).pushToken)).toEqual([
      'ExponentPushToken[device-1]',
      'ExponentPushToken[device-2]',
    ]);
    // A token change never prompts.
    expect(device.provider.requestPermission).not.toHaveBeenCalled();
    stop();
    expect(device.listenerCount()).toBe(0);
    device.rotateToken('ExponentPushToken[device-3]');
    await flush();
    expect(env.log.to('/me/devices', 'POST')).toHaveLength(2);
  });

  it('unregisters the registered token when push is turned off', async () => {
    const env = createTestEnvironment();
    const device = fakeProvider({ permission: 'granted' });
    const registration = registrationFor(env, device.provider);
    await registration.register({ askPermission: false });
    await registration.unregister();
    expect(env.log.to('/me/devices/ExponentPushToken%5Bdevice-1%5D', 'DELETE').map((request) => request.status)).toEqual([200]);
    expect(devices(env)).toEqual([]);
  });

  it('does nothing on the web (no push there)', async () => {
    const env = createTestEnvironment();
    const registration = registrationFor(env, createUnsupportedPushProvider());
    await expect(registration.register({ askPermission: true })).resolves.toBe('unsupported');
    registration.start({ askPermission: true })();
    await registration.unregister();
    expect(env.log.requests).toEqual([]);
  });
});
