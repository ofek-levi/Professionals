// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // Generated map assets (minified Leaflet, icon paths) are type-checked but not linted.
    ignores: ["dist/*", "src/components/map/leaflet/generated/*"],
  }
]);
