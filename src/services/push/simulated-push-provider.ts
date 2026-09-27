/**
 * Simulated push provider used in demo mode.
 *
 * There is no OS-level push: the realtime connection delivers `notification.created` events and
 * the app presents them as in-app banners through a presenter (the toast host), exactly where a
 * real foreground push would appear. A stable fake device token is generated once per install and
 * registered with the backend, so the full device-registration flow is exercised.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { createId } from '@/utils/id';

import type { PushListener, PushMessage, PushPermissionStatus, PushProvider } from './types';

const TOKEN_STORAGE_KEY = '@professionals/push/device-token/v1';

/** Shows a banner for `message`; `onPress` must be called when the user taps it. */
export type PushBannerPresenter = (message: PushMessage, onPress: () => void) => void;

export interface SimulatedPushProvider extends PushProvider {
  readonly kind: 'simulated';
  /** Connects the UI that renders banners (returns a detach function). */
  setBannerPresenter(presenter: PushBannerPresenter | null): () => void;
  /** Simulates an incoming push while the app is in the foreground. */
  deliver(message: PushMessage, options?: { showBanner?: boolean }): void;
}

export interface SimulatedPushOptions {
  storage?: Pick<typeof AsyncStorage, 'getItem' | 'setItem'>;
  generateToken?: () => string;
}

export function createSimulatedPushProvider(options: SimulatedPushOptions = {}): SimulatedPushProvider {
  const storage = options.storage ?? AsyncStorage;
  const generateToken = options.generateToken ?? (() => `simulated:${createId('push')}`);
  const received = new Set<PushListener>();
  const responses = new Set<PushListener>();
  let presenter: PushBannerPresenter | null = null;
  let tokenPromise: Promise<string> | null = null;

  const emit = (listeners: Set<PushListener>, message: PushMessage) => {
    listeners.forEach((listener) => {
      try {
        listener(message);
      } catch (error) {
        if (__DEV__) console.warn('[push] listener failed', error);
      }
    });
  };

  const loadToken = async (): Promise<string> => {
    try {
      const stored = await storage.getItem(TOKEN_STORAGE_KEY);
      if (stored) return stored;
    } catch {
      // Fall through and create a new token.
    }
    const token = generateToken();
    try {
      await storage.setItem(TOKEN_STORAGE_KEY, token);
    } catch {
      // A new token will be generated on the next launch; harmless for the simulation.
    }
    return token;
  };

  return {
    kind: 'simulated',
    getPermissionStatus: async (): Promise<PushPermissionStatus> => 'granted',
    requestPermission: async (): Promise<PushPermissionStatus> => 'granted',
    getDeviceToken() {
      tokenPromise ??= loadToken();
      return tokenPromise;
    },
    onNotification(listener) {
      received.add(listener);
      return () => {
        received.delete(listener);
      };
    },
    onNotificationResponse(listener) {
      responses.add(listener);
      return () => {
        responses.delete(listener);
      };
    },
    setBannerPresenter(next) {
      presenter = next;
      return () => {
        if (presenter === next) presenter = null;
      };
    },
    deliver(message, { showBanner = true } = {}) {
      emit(received, message);
      if (showBanner && presenter) presenter(message, () => emit(responses, message));
    },
  };
}
