/**
 * In-memory `expo-notifications` for Jest (the module is native; its JS warns in Jest). Covers what
 * `services/push/expo-push-provider.ts` uses, with `__notifications` controls: the OS permission,
 * the device token, a token rotation, a notification tap and the tap that launched the app.
 */
export const DEFAULT_ACTION_IDENTIFIER = 'expo.modules.notifications.actions.DEFAULT';

export enum AndroidImportance {
  UNKNOWN = 0,
  UNSPECIFIED = 1,
  NONE = 2,
  MIN = 3,
  LOW = 4,
  DEFAULT = 5,
  HIGH = 6,
  MAX = 7,
}

export enum IosAuthorizationStatus {
  NOT_DETERMINED = 0,
  DENIED = 1,
  AUTHORIZED = 2,
  PROVISIONAL = 3,
  EPHEMERAL = 4,
}

type PermissionStatus = 'granted' | 'denied' | 'undetermined';

interface MockResponse {
  actionIdentifier: string;
  notification: { request: { identifier: string; content: { data: unknown } } };
}

interface Subscription {
  remove(): void;
}

interface NotificationHandler {
  handleNotification(): Promise<Record<string, boolean>>;
}

const state = {
  permission: 'undetermined' as PermissionStatus,
  /** Status after the system dialog. */
  afterPrompt: 'granted' as PermissionStatus,
  provisional: false,
  token: 'ExponentPushToken[jest-device]',
  tokenError: null as Error | null,
  launchResponse: null as MockResponse | null,
  handler: null as NotificationHandler | null,
  channels: new Map<string, Record<string, unknown>>(),
  tokenRequests: [] as { projectId?: string }[],
  tokenListeners: new Set<() => void>(),
  responseListeners: new Set<(response: MockResponse) => void>(),
};

const permissionResponse = (status: PermissionStatus) => ({
  status,
  granted: status === 'granted',
  canAskAgain: status === 'undetermined',
  expires: 'never',
  ...(state.provisional ? { ios: { status: IosAuthorizationStatus.PROVISIONAL } } : {}),
});

const subscription = <T>(set: Set<T>, listener: T): Subscription => {
  set.add(listener);
  return { remove: () => void set.delete(listener) };
};

export function setNotificationHandler(handler: NotificationHandler | null): void {
  state.handler = handler;
}

export async function getPermissionsAsync() {
  return permissionResponse(state.permission);
}

export async function requestPermissionsAsync() {
  if (state.permission === 'undetermined') state.permission = state.afterPrompt;
  return permissionResponse(state.permission);
}

export async function setNotificationChannelAsync(id: string, channel: Record<string, unknown>) {
  state.channels.set(id, channel);
  return { id, ...channel };
}

export async function getExpoPushTokenAsync(options: { projectId?: string } = {}) {
  state.tokenRequests.push(options);
  if (state.tokenError) throw state.tokenError;
  return { type: 'expo', data: state.token };
}

export function addPushTokenListener(listener: () => void): Subscription {
  return subscription(state.tokenListeners, listener);
}

export function addNotificationResponseReceivedListener(listener: (response: MockResponse) => void): Subscription {
  return subscription(state.responseListeners, listener);
}

export function getLastNotificationResponse(): MockResponse | null {
  return state.launchResponse;
}

export function clearLastNotificationResponse(): void {
  state.launchResponse = null;
}

/** A tap on a notification whose `data` is `data`. */
export function tapResponse(identifier: string, data: unknown, actionIdentifier = DEFAULT_ACTION_IDENTIFIER): MockResponse {
  return { actionIdentifier, notification: { request: { identifier, content: { data } } } };
}

/** Test controls (not part of expo-notifications). */
export const __notifications = {
  state,
  reset(): void {
    state.permission = 'undetermined';
    state.afterPrompt = 'granted';
    state.provisional = false;
    state.token = 'ExponentPushToken[jest-device]';
    state.tokenError = null;
    state.launchResponse = null;
    state.handler = null;
    state.channels.clear();
    state.tokenRequests.length = 0;
    state.tokenListeners.clear();
    state.responseListeners.clear();
  },
  /** The OS issued a new device token. */
  rotateToken(token: string): void {
    state.token = token;
    state.tokenListeners.forEach((listener) => listener());
  },
  /** The user tapped a notification while the app runs. */
  tap(response: MockResponse): void {
    state.responseListeners.forEach((listener) => listener(response));
  },
};
