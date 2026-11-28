// Written with the help of Claude
import { describe, expect, test } from '@jest/globals';

import { wheelZoom } from '@/components/pictures/web-crop-gestures';

describe('wheelZoom', () => {
  test('zooms in on a wheel turned up and out on one turned down', () => {
    expect(wheelZoom(2, -100, false, 5)).toBeGreaterThan(2);
    expect(wheelZoom(2, 100, false, 5)).toBeLessThan(2);
  });

  test('keeps the zoom of the phone: from 1, where the picture covers the frame, to the maximum', () => {
    expect(wheelZoom(1, 1000, false, 5)).toBe(1);
    expect(wheelZoom(4.9, -1000, false, 5)).toBe(5);
  });

  // A trackpad pinch sends small deltas with ctrlKey; each counts for more than a wheel pixel.
  test('turns a trackpad pinch faster than the wheel', () => {
    expect(wheelZoom(1, -10, true, 5)).toBeGreaterThan(wheelZoom(1, -10, false, 5));
  });
});
