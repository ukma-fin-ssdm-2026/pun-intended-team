// Written with the help of Claude
import { describe, expect, test } from '@jest/globals';

import { textPreview } from '@/text-preview';

describe('textPreview', () => {
  test('leaves a text that fits the limit without a preview', () => {
    expect(textPreview('Камерний джаз.', 14)).toBeUndefined();
    expect(textPreview('Камерний джаз.', 100)).toBeUndefined();
  });

  test('cuts a longer text at the last whole word within the limit', () => {
    expect(textPreview('Вечір камерного джазу в Арсеналі', 20)).toBe('Вечір камерного');
  });

  test('drops the punctuation before the cut', () => {
    expect(textPreview('Вечір джазу, квартет і гості', 14)).toBe('Вечір джазу');
    expect(textPreview('Вечір джазу: квартет і гості', 14)).toBe('Вечір джазу');
  });

  // The Figma text of the jazz evening on the event page.
  test('gives the event page preview at 105 characters', () => {
    const description =
      'Вечір камерного джазу в залах Мистецького Арсеналу: квартет виконає авторські композиції та імпровізації ' +
      'на теми класичних стандартів.';
    expect(textPreview(description, 105)).toBe(
      'Вечір камерного джазу в залах Мистецького Арсеналу: квартет виконає авторські композиції та імпровізації',
    );
  });
});
