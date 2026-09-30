/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * The expo-notifications push provider (iOS/Android): Expo token for the EAS project id (push off
 * without one), Android channel, permission states, foreground presentation, token changes and
 * notification taps (including the one that launched the app, delivered once).
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { __notifications, tapResponse } from '@/test-utils/native/expo-notifications.mock';

import type { PushProvider, PushTap } from '../types';

const ORIGINAL_OS = Platform.OS;

/** React Native resolves `Platform` lazily: set it in the isolated registry and the main one. */
function setPlatform(os: typeof Platform.OS, platform: typeof Platform = Platform) {
  Object.defineProperty(platform, 'OS', { value: os, configurable: true });
}

interface ProviderOptions {
  platform?: 'ios' | 'android';
  projectId?: string | null;
  isDevice?: boolean;
}

/** A provider built the way the app builds it at launch (module state is fresh). */
function launchProvider({ platform = 'android', projectId = 'eas-project-id', isDevice = true }: ProviderOptions = {}): PushProvider {
  let provider: PushProvider | undefined;
  jest.isolateModules(() => {
    jest.doMock('expo-notifications', () => Notifications);
    jest.doMock('expo-device', () => ({ isDevice }));
    jest.doMock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: {} }, easConfig: null } }));
    jest.doMock('@/config/env', () => ({ env: { easProjectId: projectId } }));
    jest.doMock('@/i18n', () => ({ i18n: { t: (key: string) => `t(${key})` } }));
    setPlatform(platform, (require('react-native') as typeof import('react-native')).Platform);
    const { createExpoPushProvider } = require('../expo-push-provider') as typeof import('../expo-push-provider');
    provider = createExpoPushProvider(platform);
  });
  setPlatform(platform);
  return provider!;
}

const target = { kind: 'conversation', conversationId: 'cnv_1' } as const;
const data = { notificationId: 'ntf_1', notificationType: 'new_message', target };

let warn: jest.SpyInstance;
beforeEach(() => {
  __notifications.reset();
  warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  warn.mockRestore();
  setPlatform(ORIGINAL_OS);
});

describe('Expo push provider', () => {
  it('issues the Expo push token for the EAS project id, after creating the Android channel', async () => {
    const provider = launchProvider();
    expect(provider).toMatchObject({ isSupported: true, platform: 'android' });
    await expect(provider.getPushToken()).resolves.toBe('ExponentPushToken[jest-device]');
    expect(__notifications.state.tokenRequests).toEqual([{ projectId: 'eas-project-id' }]);
    expect(__notifications.state.channels.get('default')).toMatchObject({
      name: 't(notifications:channel.name)',
      importance: Notifications.AndroidImportance.HIGH,
    });
  });

  it('is off without an EAS project id (with a development warning), and needs a physical device', async () => {
    const noProject = launchProvider({ projectId: null });
    expect(noProject.isSupported).toBe(false);
    await expect(noProject.getPushToken()).resolves.toBeNull();
    expect(warn).toHaveBeenCalledWith('[push] EXPO_PUBLIC_EAS_PROJECT_ID is not set: push notifications are off.');

    const simulator = launchProvider({ isDevice: false });
    await expect(simulator.getPushToken()).resolves.toBeNull();
    expect(__notifications.state.tokenRequests).toEqual([]);
  });

  it('answers null when no token can be issued (e.g. no FCM configuration)', async () => {
    __notifications.state.tokenError = new Error('FirebaseApp is not initialized');
    await expect(launchProvider().getPushToken()).resolves.toBeNull();
  });

  it('reports permissions and asks once through the system dialog (provisional counts as granted)', async () => {
    const provider = launchProvider({ platform: 'ios' });
    await expect(provider.getPermissionStatus()).resolves.toBe('undetermined');
    await expect(provider.requestPermission()).resolves.toBe('granted');
    __notifications.reset();
    __notifications.state.afterPrompt = 'denied';
    await expect(provider.requestPermission()).resolves.toBe('denied');
    __notifications.reset();
    __notifications.state.permission = 'denied';
    __notifications.state.provisional = true;
    await expect(provider.getPermissionStatus()).resolves.toBe('granted');
  });

  it('keeps OS banners out of the foreground (the in-app banner shows) but lists the notification', async () => {
    launchProvider();
    await expect(__notifications.state.handler?.handleNotification()).resolves.toEqual({
      shouldShowBanner: false,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    });
  });

  it('reports token changes until unsubscribed', () => {
    const provider = launchProvider();
    const listener = jest.fn();
    const stop = provider.onTokenChange(listener);
    __notifications.rotateToken('ExponentPushToken[rotated]');
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
    __notifications.rotateToken('ExponentPushToken[again]');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('delivers taps with the server data, once each, including the tap that launched the app', () => {
    __notifications.state.launchResponse = tapResponse('launch-1', data);
    const provider = launchProvider();
    const taps: PushTap[] = [];
    const stop = provider.onTap((tap) => taps.push(tap));
    // The launch tap is consumed right away, and not delivered again by the listener.
    expect(taps).toEqual([{ notificationId: 'ntf_1', notificationType: 'new_message', target }]);
    expect(__notifications.state.launchResponse).toBeNull();
    __notifications.tap(tapResponse('launch-1', data));
    expect(taps).toHaveLength(1);

    __notifications.tap(tapResponse('n-2', { ...data, notificationId: 'ntf_2', target: { kind: 'job', jobId: 'job_1' } }));
    expect(taps[1]).toEqual({ notificationId: 'ntf_2', notificationType: 'new_message', target: { kind: 'job', jobId: 'job_1' } });
    // Other actions and payloads without a valid target are ignored.
    __notifications.tap(tapResponse('n-3', data, 'expo.modules.notifications.actions.DISMISS'));
    __notifications.tap(tapResponse('n-4', { notificationId: 'x' }));
    expect(taps).toHaveLength(2);
    stop();
    __notifications.tap(tapResponse('n-5', data));
    expect(taps).toHaveLength(2);
  });
});
