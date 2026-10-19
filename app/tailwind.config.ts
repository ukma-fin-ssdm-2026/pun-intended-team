// Written with the help of Claude
// AI Usage: Tailwind theme built from the design tokens; reviewed by Daryna Halytska.
import type { Config } from 'tailwindcss';

import { colors, fontFamilies, typography } from './src/styles/tokens';

const fontSize = Object.fromEntries(
  Object.entries(typography).map(([name, { fontSize, lineHeight }]) => [
    name,
    [`${fontSize}px`, { lineHeight: `${lineHeight}px` }] as [string, { lineHeight: string }],
  ]),
);

export default {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors,
      fontSize,
      // `font-inter-*`, not `font-medium`: those are weight utilities, and a custom font needs its family name instead.
      fontFamily: {
        inter: [fontFamilies.regular],
        'inter-medium': [fontFamilies.medium],
        'inter-semibold': [fontFamilies.semibold],
      },
    },
  },
} satisfies Config;
