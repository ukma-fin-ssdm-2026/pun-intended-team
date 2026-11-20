// Written with the help of Claude
import { describe, expect, test } from '@jest/globals';

import { actionBarPath, actionNotchFillPath } from '@/components/ui/tab-bar-shape';

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

  test('widens the flat bottom by half the extra button width on each side', () => {
    // A 300 px button is 68 px wider than Figma's 232: the flat bottom runs 34 px further each way.
    const path = actionBarPath(390, 96, 300);

    expect(path).toContain('H314.22 ');
    expect(path).toMatch(/C\S+ \S+ \S+ \S+ \S+ 62 H314\.22/);
    expect(path).toContain(' 75.78 62 ');
  });

  test('keeps a wide button’s notch clear of the corners on a 393 px screen', () => {
    const [, notchStart] = /H(\d+(?:\.\d+)?) C/.exec(actionBarPath(393, 96, 340)) ?? [];

    expect(Number(notchStart)).toBeGreaterThanOrEqual(24);
  });
});

// "Форма з вирізом" of "таб бар 2", around the 266 px "Стежити за метчингом", moved out of the export's 18 px padding.
const FIGMA_WIDE_PATH =
  'M0 96 V24 C0 10.74 10.74 0 24 0 H26 C51.82 0 49.39 25.11 65.99 49.37 C73.1 57.46 82.73 62 92.78 62 ' +
  'H297.22 C307.27 62 316.9 57.46 324.01 49.37 C340.61 25.11 338.18 0 364 0 H366 C379.26 0 390 10.74 390 24 V96 Z';

test('actionBarPath draws the "таб бар 2" shape around a 266 px button at 390 px', () => {
  expect(actionBarPath(390, 96, 266)).toBe(FIGMA_WIDE_PATH);
});

describe('actionNotchFillPath', () => {
  test('closes the Figma notch along the top edge, so it can be filled white', () => {
    expect(actionNotchFillPath(390)).toBe(
      'M31.65 0 C64.8 0 61.68 25.11 82.99 49.37 C90.1 57.46 99.73 62 109.78 62 H280.22 ' +
        'C290.27 62 299.9 57.46 307.01 49.37 C328.32 25.11 325.2 0 358.35 0 Z',
    );
  });

  test('follows the bar’s notch for a wider button', () => {
    const bar = actionBarPath(393, 96, 300);
    const notch = actionNotchFillPath(393, 300);

    expect(bar).toContain(notch.slice(1, -2).replace(/^[\d.]+ 0 /, ''));
  });
});
