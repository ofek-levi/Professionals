/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Native animation/map modules are replaced by their official (or local) Jest mocks.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => {
  const reanimated = require('react-native-reanimated/mock');
  // The official mock lacks `useReducedMotion` (used by skeletons).
  return { ...reanimated, useReducedMotion: () => false };
});
jest.mock('react-native-maps', () => require('@/components/map/react-native-maps.mock'));
