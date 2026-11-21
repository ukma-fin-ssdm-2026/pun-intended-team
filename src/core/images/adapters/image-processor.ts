// Written with the help of Claude
import type { EncodedImage, PixelArea } from '../types/image.ts';

export interface EncodeOptions {
  /** Cut out first, in pixels of the picture after EXIF rotation. */
  crop?: PixelArea;
  /** Scaled down, never up, to fit inside this box, keeping its shape. */
  maxWidth: number;
  maxHeight: number;
}

/** Decodes and re-encodes uploaded pictures (HLD I5). */
export abstract class ImageProcessor {
  /** The size after EXIF rotation; undefined when the content is not a picture it accepts. */
  abstract measure(content: Uint8Array): Promise<{ width: number; height: number } | undefined>;

  /** Rotated by its EXIF orientation, without metadata (no location), in one format for every upload. */
  abstract encode(content: Uint8Array, options: EncodeOptions): Promise<EncodedImage>;
}
