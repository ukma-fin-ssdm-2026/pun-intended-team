// Written with the help of Claude
import { describe, expect, test } from '@jest/globals';

import { pictureType } from '@/pictures/picked-picture';

const bytes = (...parts: (string | number[])[]) =>
  new Uint8Array(parts.flatMap((part) => (typeof part === 'string' ? [...part].map((c) => c.charCodeAt(0)) : part)));

describe('pictureType', () => {
  test('reads JPEG, PNG and WebP by their signature', () => {
    expect(pictureType(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(pictureType(bytes([0x89], 'PNG\r\n\x1a\n'))).toBe('image/png');
    expect(pictureType(bytes('RIFF', [1, 2, 3, 4], 'WEBPVP8 '))).toBe('image/webp');
  });

  test('refuses HEIC, GIF and an empty file', () => {
    expect(pictureType(bytes([0, 0, 0, 0x18], 'ftypheic'))).toBeUndefined();
    expect(pictureType(bytes('GIF89a'))).toBeUndefined();
    expect(pictureType(new Uint8Array())).toBeUndefined();
  });
});
