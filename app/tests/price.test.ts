// Written with the help of Claude
import { describe, expect, test } from '@jest/globals';

import { priceLabel } from '@/price';

// Written out, so a regular space in a label fails the test.
const NBSP = ' ';

describe('priceLabel', () => {
  test.each([
    { min: 450, max: null, label: `450${NBSP}₴`, title: 'one price' },
    { min: 450, max: 450, label: `450${NBSP}₴`, title: 'a range of one price' },
    { min: 300, max: 700, label: `300–700${NBSP}₴`, title: 'a range, with an en dash and no spaces around it' },
    { min: 0, max: 500, label: `0–500${NBSP}₴`, title: 'a range from free' },
    { min: 0, max: null, label: 'Безкоштовно', title: 'a free event' },
    { min: 0, max: 0, label: 'Безкоштовно', title: 'a free event written as 0 to 0' },
    { min: 1200, max: 2500, label: `1${NBSP}200–2${NBSP}500${NBSP}₴`, title: 'thousands' },
    { min: 999, max: 1000, label: `999–1${NBSP}000${NBSP}₴`, title: 'the first thousand' },
    { min: 12500, max: null, label: `12${NBSP}500${NBSP}₴`, title: 'tens of thousands' },
    { min: 1_000_000, max: null, label: `1${NBSP}000${NBSP}000${NBSP}₴`, title: 'the highest price the API takes' },
  ])('shows $title as "$label"', ({ min, max, label }) => {
    expect(priceLabel(min, max)).toBe(label);
  });

  test('shows no tag for an unknown price', () => {
    expect(priceLabel(null, null)).toBeUndefined();
  });

  // The API never sends these; the card still shows nothing wrong.
  test('shows no tag for a highest price without a lowest one', () => {
    expect(priceLabel(null, 700)).toBeUndefined();
  });

  test('shows the lowest price alone when the highest is below it', () => {
    expect(priceLabel(700, 300)).toBe(`700${NBSP}₴`);
  });
});
