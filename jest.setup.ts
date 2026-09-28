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
