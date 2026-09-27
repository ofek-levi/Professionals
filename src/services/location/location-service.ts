/**
 * Device location, isolated behind a tiny API so the rest of the app never touches `expo-location`
 * directly.
 *
 * The device position is only ever used as a *hint* (pre-filling an address, centering a map).
 * Authoritative matching (service areas, distances, privacy of exact addresses) happens on the
 * backend using the request's stored `ServiceLocation`, so swapping this module for another
 * provider has no business impact.
 *
 * Permission is never requested implicitly: call `requestLocationPermission()` / `locateDevice()`
 * only in response to an explicit user action (e.g. "Use my current location").
 */
import * as Location from 'expo-location';
import { Linking, Platform } from 'react-native';

import type { GeoCoordinates } from '@/types/domain';

export type LocationPermissionStatus = 'granted' | 'denied' | 'undetermined';

export interface LocationPermissionState {
  status: LocationPermissionStatus;
  /** `false` when the OS will not show the prompt again (user must use system settings). */
  canAskAgain: boolean;
}

export type LocationFailureReason =
  /** The user declined the prompt (it can be shown again). */
  | 'permission_denied'
  /** Permission denied permanently – only system settings can change it. */
  | 'permission_blocked'
  /** Location services / GPS are switched off. */
  | 'services_disabled'
  /** No fix within the timeout. */
  | 'timeout'
  /** Anything else (no hardware, insecure web origin, provider error…). */
  | 'unavailable';

export type CurrentCoordinatesResult =
  | {
      ok: true;
      coordinates: GeoCoordinates;
      /** Horizontal accuracy radius in meters, when reported. */
      accuracyMeters: number | null;
      /** `last_known` when a recent cached fix was used after a timeout. */
      source: 'current' | 'last_known';
    }
  | { ok: false; reason: LocationFailureReason };

export interface GetCoordinatesOptions {
  /** Give up after this long (default 12s). */
  timeoutMs?: number;
  /** `balanced` (default) is faster and plenty for address pre-filling. */
  accuracy?: 'balanced' | 'high';
  /** Accept a cached fix up to this age when a fresh one times out (default 10 minutes). */
  maxLastKnownAgeMs?: number;
}

const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_MAX_LAST_KNOWN_AGE_MS = 10 * 60 * 1000;

function toPermissionState(response: Location.LocationPermissionResponse): LocationPermissionState {
  const status: LocationPermissionStatus =
    response.status === Location.PermissionStatus.GRANTED
      ? 'granted'
      : response.status === Location.PermissionStatus.DENIED
        ? 'denied'
        : 'undetermined';
  return { status, canAskAgain: response.canAskAgain };
}

/** Current foreground permission, without prompting. */
export async function getLocationPermissionStatus(): Promise<LocationPermissionState> {
  try {
    return toPermissionState(await Location.getForegroundPermissionsAsync());
  } catch {
    return { status: 'undetermined', canAskAgain: true };
  }
}

/** Shows the OS prompt when possible and returns the resulting permission. */
export async function requestLocationPermission(): Promise<LocationPermissionState> {
  try {
    return toPermissionState(await Location.requestForegroundPermissionsAsync());
  } catch {
    return { status: 'denied', canAskAgain: false };
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | 'timeout'> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve('timeout'), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function toResult(position: Location.LocationObject, source: 'current' | 'last_known'): CurrentCoordinatesResult {
  return {
    ok: true,
    coordinates: { latitude: position.coords.latitude, longitude: position.coords.longitude },
    accuracyMeters: position.coords.accuracy ?? null,
    source,
  };
}

async function servicesEnabled(): Promise<boolean> {
  if (Platform.OS === 'web') return true;
  try {
    return await Location.hasServicesEnabledAsync();
  } catch {
    return true;
  }
}

async function lastKnownPosition(maxAgeMs: number): Promise<Location.LocationObject | null> {
  if (Platform.OS === 'web') return null;
  try {
    return await Location.getLastKnownPositionAsync({ maxAge: maxAgeMs });
  } catch {
    return null;
  }
}

/**
 * Reads the device position. Requires permission to already be granted – it never prompts.
 * Never throws: failures are returned as `{ ok: false, reason }`.
 */
export async function getCurrentCoordinates(options: GetCoordinatesOptions = {}): Promise<CurrentCoordinatesResult> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    accuracy = 'balanced',
    maxLastKnownAgeMs = DEFAULT_MAX_LAST_KNOWN_AGE_MS,
  } = options;

  const permission = await getLocationPermissionStatus();
  if (permission.status !== 'granted') {
    return { ok: false, reason: permission.canAskAgain ? 'permission_denied' : 'permission_blocked' };
  }
  if (!(await servicesEnabled())) return { ok: false, reason: 'services_disabled' };

  try {
    const position = await withTimeout(
      Location.getCurrentPositionAsync({
        accuracy: accuracy === 'high' ? Location.Accuracy.High : Location.Accuracy.Balanced,
      }),
      timeoutMs,
    );
    if (position !== 'timeout') return toResult(position, 'current');
    const cached = await lastKnownPosition(maxLastKnownAgeMs);
    return cached ? toResult(cached, 'last_known') : { ok: false, reason: 'timeout' };
  } catch {
    const cached = await lastKnownPosition(maxLastKnownAgeMs);
    return cached ? toResult(cached, 'last_known') : { ok: false, reason: 'unavailable' };
  }
}

/**
 * The "use my current location" flow: asks for permission if needed (and allowed), then reads the
 * position. Call only from a user gesture.
 */
export async function locateDevice(options: GetCoordinatesOptions = {}): Promise<CurrentCoordinatesResult> {
  let permission = await getLocationPermissionStatus();
  if (permission.status !== 'granted' && permission.canAskAgain) {
    permission = await requestLocationPermission();
  }
  if (permission.status !== 'granted') {
    return { ok: false, reason: permission.canAskAgain ? 'permission_denied' : 'permission_blocked' };
  }
  return getCurrentCoordinates(options);
}

/** Opens the app's system settings page (to re-enable a blocked permission). No-op on web. */
export async function openLocationSettings(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Linking.openSettings();
  } catch {
    // Nothing else we can do.
  }
}
