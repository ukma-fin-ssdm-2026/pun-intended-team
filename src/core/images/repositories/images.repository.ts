// Written with the help of Claude
import type { Transaction } from '../../common/transaction.ts';
import type { ImageFile, ImageRecord, ImageRef } from '../types/image.ts';

export abstract class ImagesRepository {
  abstract create(image: ImageRecord, tx?: Transaction): Promise<ImageRef>;

  /** Without their content. */
  abstract findRefs(ids: string[]): Promise<ImageRef[]>;

  abstract findFile(id: string): Promise<ImageFile | undefined>;

  abstract delete(ids: string[], tx?: Transaction): Promise<void>;
}
