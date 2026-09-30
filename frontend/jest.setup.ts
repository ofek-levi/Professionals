/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Native animation modules are replaced by their official Jest mocks.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => {
  const reanimated = require('react-native-reanimated/mock');
  // The official mock lacks `useReducedMotion` (used by skeletons).
  return { ...reanimated, useReducedMotion: () => false };
});
// The map's WebView: a View exposing its props (see src/components/__test-utils__/map-bridge.ts).
jest.mock('react-native-webview', () => require('@/components/__test-utils__/react-native-webview.mock'));

// Native modules and runtime globals the app relies on (see src/test-utils/native).
jest.mock('expo-secure-store', () => require('@/test-utils/native/expo-secure-store.mock'));
jest.mock('expo-notifications', () => require('@/test-utils/native/expo-notifications.mock'));
// React Native's FormData (file parts are `{ uri, name, type }`), not Node's.
global.FormData = jest.requireActual('react-native/Libraries/Network/FormData').default;
// No test may dial a real backend over WebSocket.
global.WebSocket = require('@/test-utils/native/inert-websocket').InertWebSocket;
