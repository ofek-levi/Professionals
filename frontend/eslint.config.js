// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

/** Where tests and their helpers live: the only code allowed to import test doubles. */
const TEST_FILES = [
  "src/**/__tests__/**",
  "src/**/__test-utils__/**",
  "src/test-utils/**",
  "**/*.test.ts",
  "**/*.test.tsx",
];

module.exports = defineConfig([
  expoConfig,
  {
    // Generated map assets (minified Leaflet, icon paths) are type-checked but not linted.
    ignores: ["dist/*", "src/components/map/leaflet/generated/*"],
  },
  {
    // The app talks only to the real backend: the backend test double and other test helpers
    // (src/test-utils, __test-utils__) must never reach the app bundle.
    files: ["src/**/*.{ts,tsx}", "app.config.ts"],
    ignores: TEST_FILES,
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/test-utils", "@/test-utils/**", "**/test-utils/**", "**/__test-utils__/**"],
              message: "Test doubles are for tests only: app code talks to the real backend (src/services/api).",
            },
          ],
        },
      ],
    },
  },
]);
