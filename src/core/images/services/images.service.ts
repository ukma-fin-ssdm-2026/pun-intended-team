// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { DomainError } from '../../common/domain-error.ts';
import type { Transaction } from '../../common/transaction.ts';
import { ImageProcessor } from '../adapters/image-processor.ts';
import { ImagesRepository } from '../repositories/images.repository.ts';
import type { EncodedImage, ImageFile, ImageKind, ImageRef, ImageUpload, PixelArea } from '../types/image.ts';
import { imageKinds, pixelCrop, scaleArea } from './image-kinds.ts';

/** A picture ready to store: what `prepare` makes of an upload. */
export interface PreparedImage {
  encoded: EncodedImage;
  crop: PixelArea | null;
}

@Injectable()
export class ImagesService {
  constructor(
    private readonly imagesRepository: ImagesRepository,
    private readonly imageProcessor: ImageProcessor,
  ) {}

  /**
   * Decodes, crops and re-encodes an upload; slow, so callers do it before they open a transaction. Throws
   * `INVALID_IMAGE` when the content is not a picture of an accepted type.
   */
  async prepare(kind: ImageKind, upload: ImageUpload): Promise<PreparedImage> {
    const size = await this.imageProcessor.measure(upload.content);
    if (!size) {
      throw new DomainError('INVALID_IMAGE', 'The file is not a JPEG, PNG or WebP picture');
    }
    const settings = imageKinds[kind];
    const crop = pixelCrop(upload.crop, size, settings.aspectRatio);
    const box = { maxWidth: settings.maxWidth, maxHeight: settings.maxHeight };
    if (!settings.keepWhole) {
      return { encoded: await this.imageProcessor.encode(upload.content, { ...box, crop }), crop: null };
    }
    const encoded = await this.imageProcessor.encode(upload.content, box);
    return { encoded, crop: scaleArea(crop, size, encoded) };
  }

  async save(ownerId: string, { encoded, crop }: PreparedImage, tx?: Transaction): Promise<ImageRef> {
    return this.imagesRepository.create({ ownerId, ...encoded, crop }, tx);
  }

  /** By id; ids without an image are left out. */
  async getRefs(ids: (string | null)[]): Promise<Map<string, ImageRef>> {
    const wanted = [...new Set(ids.filter((id): id is string => id !== null))];
    const refs = wanted.length > 0 ? await this.imagesRepository.findRefs(wanted) : [];
    return new Map(refs.map((ref) => [ref.id, ref]));
  }

  async getFile(id: string): Promise<ImageFile> {
    const file = await this.imagesRepository.findFile(id);
    if (!file) {
      throw new DomainError('NOT_FOUND', 'Image not found');
    }
    return file;
  }

  async remove(ids: (string | null)[], tx?: Transaction): Promise<void> {
    const existing = ids.filter((id): id is string => id !== null);
    if (existing.length > 0) {
      await this.imagesRepository.delete(existing, tx);
    }
  }
}
