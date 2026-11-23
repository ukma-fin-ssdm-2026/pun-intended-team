// Written with the help of Claude
import { describe, expect, test } from '@jest/globals';

import { aspectRatios, toFractions, visibleArea } from '@/pictures/geometry';

// A 2000 × 1500 cover whose owner picked a 390:200 band across the middle.
const picture = { width: 2000, height: 1500 };
const crop = { left: 25, top: 250, width: 1950, height: 1000 };

describe('visibleArea', () => {
  test('shows the crop as it is in a box of its shape', () => {
    expect(visibleArea(picture, crop, aspectRatios.profileCover)).toEqual(crop);
  });

  test('shows more above and below the crop in a taller box, as on a narrow phone', () => {
    const area = visibleArea(picture, { left: 500, top: 500, width: 780, height: 400 }, 320 / 200);
    expect(area.width).toBe(780);
    expect(area.height).toBeCloseTo(487.5);
    expect(area.top).toBeCloseTo(456.25);
  });

  test('shows more beside the crop in a wider box, as on the proposal card', () => {
    const area = visibleArea(picture, { left: 600, top: 500, width: 780, height: 400 }, 330 / 118);
    expect(area.height).toBe(400);
    expect(area.width).toBeCloseTo(1118.6, 1);
    expect(area.left).toBeCloseTo(430.7, 1);
  });

  test('cuts the crop around its centre once the picture runs out, as on the 1440 × 260 desktop cover', () => {
    const area = visibleArea(picture, crop, 1440 / 260);
    expect(area.width).toBe(2000);
    expect(area.height).toBeCloseTo(361.1, 1);
    expect(area.top + area.height / 2).toBeCloseTo(crop.top + crop.height / 2);
  });

  test('stays inside the picture when the crop is at its edge', () => {
    const area = visibleArea(picture, { left: 0, top: 0, width: 780, height: 400 }, 1);
    expect(area).toEqual({ left: 0, top: 0, width: 780, height: 780 });
  });
});

describe('toFractions', () => {
  test('gives the area as fractions of the picture', () => {
    expect(toFractions({ left: 500, top: 375, width: 1000, height: 750 }, picture)).toEqual({
      left: 0.25,
      top: 0.25,
      width: 0.5,
      height: 0.5,
    });
  });
});
