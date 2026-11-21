// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import fc from 'fast-check';
import { imageKinds, pixelCrop, scaleArea } from '../../dist/core/images/services/image-kinds.js';

const cover = imageKinds.profileCover.aspectRatio;

describe('pixelCrop', () => {
  test('turns fractions into pixels when the area already has the shape', () => {
    assert.deepEqual(pixelCrop({ left: 0.25, top: 0, width: 0.5, height: 1 }, { width: 800, height: 400 }, 1), {
      left: 200,
      top: 0,
      width: 400,
      height: 400,
    });
  });

  test('cuts the largest area of the shape inside the one picked, around its centre', () => {
    // The whole 400 × 300 picture as a square: 300 × 300 in the middle.
    assert.deepEqual(pixelCrop({ left: 0, top: 0, width: 1, height: 1 }, { width: 400, height: 300 }, 1), {
      left: 50,
      top: 0,
      width: 300,
      height: 300,
    });
  });

  test('always has the shape and stays inside the picture', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 6000 }),
        fc.integer({ min: 1, max: 6000 }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0.01, max: 1, noNaN: true }),
        fc.double({ min: 0.01, max: 1, noNaN: true }),
        fc.constantFrom(1, 2, cover),
        (width, height, left, top, cropWidth, cropHeight, ratio) => {
          const crop = {
            left: Math.min(left, 1 - cropWidth),
            top: Math.min(top, 1 - cropHeight),
            width: cropWidth,
            height: cropHeight,
          };
          const area = pixelCrop(crop, { width, height }, ratio);
          assert.ok(area.left >= 0 && area.top >= 0 && area.width >= 1 && area.height >= 1);
          assert.ok(area.left + area.width <= width && area.top + area.height <= height, JSON.stringify(area));
          // Rounding to whole pixels moves the shape by at most a pixel on each side.
          assert.ok(Math.abs(area.width - area.height * ratio) <= ratio + 1, JSON.stringify(area));
        },
      ),
    );
  });
});

describe('scaleArea', () => {
  test('keeps the area in a copy of half the size', () => {
    assert.deepEqual(
      scaleArea(
        { left: 100, top: 50, width: 390, height: 200 },
        { width: 1000, height: 800 },
        { width: 500, height: 400 },
      ),
      { left: 50, top: 25, width: 195, height: 100 },
    );
  });
});
