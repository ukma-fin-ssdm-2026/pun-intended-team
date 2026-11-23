// Written with the help of Claude
import sharp from 'sharp';
import { ImageProcessor, type EncodeOptions } from '../../core/images/adapters/image-processor.ts';
import { DomainError } from '../../core/common/domain-error.ts';
import type { EncodedImage } from '../../core/images/types/image.ts';

const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp']);
// A 48-megapixel phone photo fits; a small file that decodes to a huge picture does not.
const MAX_PIXELS = 60_000_000;
const WEBP_QUALITY = 82;

export class SharpImageProcessor extends ImageProcessor {
  async measure(content: Uint8Array): Promise<{ width: number; height: number } | undefined> {
    const metadata = await sharp(content)
      .metadata()
      .catch(() => undefined);
    if (!metadata?.format || !ACCEPTED_FORMATS.has(metadata.format)) {
      return undefined;
    }
    const { width, height } = metadata.autoOrient;
    return width > 0 && height > 0 && width * height <= MAX_PIXELS ? { width, height } : undefined;
  }

  async encode(content: Uint8Array, { crop, maxWidth, maxHeight }: EncodeOptions): Promise<EncodedImage> {
    let pipeline = sharp(content, { limitInputPixels: MAX_PIXELS, failOn: 'error' }).autoOrient();
    if (crop) {
      pipeline = pipeline.extract(crop);
    }
    // measure reads only the header, so a broken body shows up here.
    const { data, info } = await pipeline
      .resize({ width: maxWidth, height: maxHeight, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true })
      .catch(() => {
        throw new DomainError('INVALID_IMAGE', 'The picture could not be read');
      });
    return { content: data, contentType: 'image/webp', width: info.width, height: info.height };
  }
}
