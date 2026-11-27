// AI Usage Note: generated with Claude (Claude Code); verified by running npm run lint; reviewed by Daryna Halytska.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@/mocks', '@/mocks/*'], message: 'Mock data is only for tests and /dev/components (#486)' },
          ],
        },
      ],
    },
  },
  {
    files: ['src/mocks/**', 'src/app/dev/**', 'tests/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
]);
