// Written with the help of Claude
import { Controller } from '@nestjs/common';
import { ImagesService } from '../../../core/images/services/images.service.ts';
import type { Caller } from '../../../core/identity/types/caller.ts';
import type { ImageFile } from '../../../core/images/types/image.ts';
import { CurrentCaller } from '../../common/auth.ts';
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
      'A guest token gets only event photos and organization logos, which the catalog shows. ' +
      'An image never changes: a new upload gets a new id, so clients may cache it for good.',
    tags: ['Images'],
    access: 'guest',
    request: GetImageRequest,
    responses: {
      200: {
        description: 'The picture',
        file: { contentTypes: [IMAGE_CONTENT_TYPE], cacheControl: 'private, max-age=31536000, immutable' },
      },
      404: { description: 'No image with this id, or a guest asked for a picture of a person', schema: ErrorResponse },
    },
    mcp: false,
  })
  async getImage(
    @Input() { params }: RouteInput<typeof GetImageRequest>,
    @CurrentCaller() caller: Caller,
  ): Promise<ImageFile> {
    return this.imagesService.getFile(params.id, { guest: caller.kind !== 'account' });
  }
}
