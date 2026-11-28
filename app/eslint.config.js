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
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      // react-native-web drops pointerEvents from an inline style, so a layer meant to let touches through catches
      // every click in a browser. The prop works on every platform.
      'no-restricted-syntax': [
        'error',
        {
          selector: "Property[key.name='pointerEvents']",
          message: 'Set pointerEvents as a prop, not in style: react-native-web ignores it in inline styles (#542)',
        },
      ],
    },
  },
  {
    files: ['src/mocks/**', 'src/app/dev/**', 'tests/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
]);
