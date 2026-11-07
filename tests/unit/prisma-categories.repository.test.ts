// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import { DomainError } from '../../dist/core/common/domain-error.js';
import { Prisma } from '../../dist/infra/prisma/generated/client.js';
import { PrismaCategoriesRepository } from '../../dist/infra/prisma/prisma-categories.repository.js';
import type { PrismaService } from '../../dist/infra/prisma/prisma.service.js';
import { CATEGORY_ID } from './fixtures/catalog.ts';

function makeRepository(failure: unknown) {
  const deleteMany = mock.fn<(args: unknown) => Promise<unknown>>();
  deleteMany.mock.mockImplementation(() => Promise.reject(failure));
  return new PrismaCategoriesRepository({ category: { deleteMany } } as unknown as PrismaService);
}

describe('PrismaCategoriesRepository.delete', () => {
  // Events and listings refer to a category with ON DELETE RESTRICT.
  test('answers a category that rows still refer to with CONFLICT', async () => {
    const foreignKeyViolation = new Prisma.PrismaClientKnownRequestError('Foreign key constraint violated', {
      code: 'P2003',
      clientVersion: '7.10.0',
    });
    const repository = makeRepository(foreignKeyViolation);

    await assert.rejects(
      repository.delete(CATEGORY_ID),
      (error) =>
        error instanceof DomainError &&
        error.code === 'CONFLICT' &&
        error.message === 'The category is in use; deactivate it instead',
    );
  });

  test('lets any other failure through unchanged', async () => {
    const failure = new Error('connection refused');
    const repository = makeRepository(failure);

    await assert.rejects(repository.delete(CATEGORY_ID), (error) => error === failure);
  });
});
