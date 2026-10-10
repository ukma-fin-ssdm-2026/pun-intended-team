// AI Usage Note: generated with Claude (Claude Code); verified by running npm run lint; reviewed by Daryna Halytska.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
]);
