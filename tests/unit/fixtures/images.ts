// Written with the help of Claude
import { mock } from 'node:test';
import type { Transaction } from '../../../dist/core/common/transaction.js';
import type { PreparedImage } from '../../../dist/core/images/services/images.service.js';
import type { ImageRef } from '../../../dist/core/images/types/image.js';

/** ImagesService and TransactionRunner as mocks: `refs` are the stored images, a save returns `saved`. */
export function fakeImages(refs: ImageRef[] = [], saved?: ImageRef) {
  const prepared: PreparedImage = {
    encoded: { content: new Uint8Array(), contentType: 'image/webp', width: 2560, height: 1280 },
    crop: null,
    isPublic: true,
  };
  const imagesService = {
    prepare: mock.fn((): Promise<PreparedImage> => Promise.resolve(prepared)),
    save: mock.fn((): Promise<ImageRef | undefined> => Promise.resolve(saved)),
    remove: mock.fn(() => Promise.resolve()),
    getRefs: mock.fn((ids: (string | null)[]) =>
      Promise.resolve(new Map(refs.filter((ref) => ids.includes(ref.id)).map((ref) => [ref.id, ref]))),
    ),
  };
  const tx = {} as Transaction;
  const transactions = { run: mock.fn(<T>(work: (tx: Transaction) => Promise<T>) => work(tx)) };
  return { imagesService, transactions, tx };
}
