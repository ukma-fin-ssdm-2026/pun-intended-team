// Written with the help of Claude
import { z } from 'zod';
import type { FileBody, RequestSchemas } from '../../common/endpoint.ts';
import { Id } from '../../common/schemas/common.ts';
import { ErrorResponse } from '../../common/schemas/errors.ts';

/** What every upload endpoint accepts: the picture as is, not as JSON or a form. */
export const ImageFileBody: FileBody = {
  contentTypes: ['image/jpeg', 'image/png', 'image/webp'],
  maxBytes: 10 * 1024 * 1024,
};

export const IMAGE_CONTENT_TYPE = 'image/webp';

export const ImageIdParams = z.object({
  id: Id.describe('Image id, from the `id` of an Image or CoverImage'),
});

const PixelArea = z
  .object({
    left: z.number().int(),
    top: z.number().int(),
    width: z.number().int(),
    height: z.number().int(),
  })
  .meta({ id: 'PixelArea', description: 'An area of the picture in its pixels' });

const imageExample = { id: '4f1d2c3b-6a5e-4d7c-9b8a-1e2f3a4b5c6d', width: 512, height: 512 };

export const Image = z
  .object({
    id: Id.describe('Get the picture with getImage'),
    width: z.number().int(),
    height: z.number().int(),
  })
  .meta({ id: 'Image', description: 'An uploaded picture, stored cropped', example: imageExample });

export const CoverImage = z
  .object({
    id: Id.describe('Get the picture with getImage'),
    width: z.number().int(),
    height: z.number().int(),
    crop: PixelArea.describe(
      'The area the user picked (390:200). A screen of another shape shows more of the picture around it, or less',
    ),
  })
  .meta({
    id: 'CoverImage',
    description: 'The profile cover: the whole picture and the area the user picked',
    example: {
      id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d',
      width: 2560,
      height: 1920,
      crop: { left: 0, top: 640, width: 2560, height: 1313 },
    },
  });

const Fraction = z.coerce.number().min(0).max(1);

/** The area the user picked in the preview, as fractions so the client need not know the stored size. */
export const CropQuery = z
  .object({
    cropLeft: Fraction.describe('Left edge, a fraction of the picture’s width (0 to 1)'),
    cropTop: Fraction.describe('Top edge, a fraction of the picture’s height (0 to 1)'),
    cropWidth: Fraction.positive().describe('Width, a fraction of the picture’s width'),
    cropHeight: Fraction.positive().describe('Height, a fraction of the picture’s height'),
  })
  .refine((crop) => crop.cropLeft + crop.cropWidth <= 1 + 1e-6, {
    message: 'The crop goes past the right edge',
    path: ['cropWidth'],
  })
  .refine((crop) => crop.cropTop + crop.cropHeight <= 1 + 1e-6, {
    message: 'The crop goes past the bottom edge',
    path: ['cropHeight'],
  });

export type CropQuery = z.output<typeof CropQuery>;

export const UploadImageRequest = { query: CropQuery, file: ImageFileBody } satisfies RequestSchemas;

export const INVALID_IMAGE = {
  description: '`INVALID_IMAGE`: the file is not a JPEG, PNG or WebP picture, is broken, or has over 60 megapixels.',
  schema: ErrorResponse,
};

export const UPLOAD_NOTE =
  'Send the picture itself as the body, with its Content-Type (JPEG, PNG or WebP, up to 10 MB), and the area picked ' +
  'in the crop preview as fractions in the query. The server cuts the largest area of the exact shape inside it, ' +
  'rotates the picture by its EXIF orientation, drops its metadata (location included) and stores it as WebP.';

export function toCrop({ cropLeft, cropTop, cropWidth, cropHeight }: CropQuery) {
  return { left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight };
}
