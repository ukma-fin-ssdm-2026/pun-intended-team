// Written with the help of Claude
import { Controller } from '@nestjs/common';
import { ImagesService } from '../../../core/images/services/images.service.ts';
import type { ImageFile } from '../../../core/images/types/image.ts';
import { Endpoint, Input, type RequestSchemas, type RouteInput } from '../../common/endpoint.ts';
import { Routes } from '../../common/routes.ts';
import { ErrorResponse } from '../../common/schemas/errors.ts';
import { IMAGE_CONTENT_TYPE, ImageIdParams } from '../schemas/images.ts';

const GetImageRequest = { params: ImageIdParams } satisfies RequestSchemas;

@Controller()
export class ImagesController {
  constructor(private readonly imagesService: ImagesService) {}

  @Endpoint({
    method: 'get',
    path: Routes.images.byId,
    operationId: 'getImage',
    summary: 'Get a picture',
    description:
      'The bytes of an uploaded picture, as WebP. Only through the API, never a public link (TM-14). ' +
      'An image never changes: a new upload gets a new id, so clients may cache it for good.',
    tags: ['Images'],
    access: 'user',
    request: GetImageRequest,
    responses: {
      200: {
        description: 'The picture',
        file: { contentTypes: [IMAGE_CONTENT_TYPE], cacheControl: 'private, max-age=31536000, immutable' },
      },
      404: { description: 'No image with this id', schema: ErrorResponse },
    },
    mcp: false,
  })
  async getImage(@Input() { params }: RouteInput<typeof GetImageRequest>): Promise<ImageFile> {
    return this.imagesService.getFile(params.id);
  }
}
