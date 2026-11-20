// Written with the help of Claude
import { describe, expect, test } from '@jest/globals';

import { actionBarPath } from '@/components/ui/tab-bar-shape';

// "Форма з вирізом" of "таб бар новий", 390 × 96, moved out of the 18 px its export pads around the shadow.
const FIGMA_PATH =
  'M0 96 V24 C0 10.74 10.74 0 24 0 H31.65 C64.8 0 61.68 25.11 82.99 49.37 C90.1 57.46 99.73 62 109.78 62 ' +
  'H280.22 C290.27 62 299.9 57.46 307.01 49.37 C328.32 25.11 325.2 0 358.35 0 H366 C379.26 0 390 10.74 390 24 V96 Z';

describe('actionBarPath', () => {
  test('draws the Figma shape at 390 px', () => {
    expect(actionBarPath(390, 96)).toBe(FIGMA_PATH);
  });

  test('keeps the notch clear of the rounded corners on a 320 px screen', () => {
    const [, notchStart] = /H(\d+(?:\.\d+)?) C/.exec(actionBarPath(320, 96)) ?? [];

    expect(Number(notchStart)).toBeGreaterThanOrEqual(24);
  });
});
