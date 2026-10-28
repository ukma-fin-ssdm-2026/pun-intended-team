// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import { DomainError } from '../../dist/core/common/domain-error.js';
import type { CategoriesRepository } from '../../dist/core/catalog/repositories/categories.repository.js';
import { CategoriesService } from '../../dist/core/catalog/services/categories.service.js';
import type { Category, CategoryChanges } from '../../dist/core/catalog/types/category.js';
import { aCategory, CATEGORY_ID } from './fixtures/catalog.ts';

const OTHER_CATEGORY_ID = 'c0000000-0000-4000-8000-000000000002';

function isDomainError(code: string) {
  return (error: unknown) => error instanceof DomainError && error.code === code;
}

/** CategoriesService with a mocked repository that knows one active category. */
function makeService() {
  const categoriesRepository = {
    findById: mock.fn((): Promise<Category | undefined> => Promise.resolve(aCategory())),
    findAll: mock.fn((): Promise<Category[]> => Promise.resolve([aCategory()])),
    update: mock.fn((id: string, changes: CategoryChanges) => Promise.resolve(aCategory({ id, ...changes }))),
    delete: mock.fn(() => Promise.resolve()),
  };
  const service = new CategoriesService(categoriesRepository as unknown as CategoriesRepository);
  return { service, categoriesRepository };
}

describe('CategoriesService.findActive', () => {
  test('returns an active category', async () => {
    const { service } = makeService();

    const category = await service.findActive(CATEGORY_ID);

    assert.deepEqual(category, aCategory());
  });

  test('hides an inactive category', async () => {
    const { service, categoriesRepository } = makeService();
    categoriesRepository.findById.mock.mockImplementation(() => Promise.resolve(aCategory({ isActive: false })));

    const category = await service.findActive(CATEGORY_ID);

    assert.equal(category, undefined);
  });

  test('answers undefined for an unknown id', async () => {
    const { service, categoriesRepository } = makeService();
    categoriesRepository.findById.mock.mockImplementation(() => Promise.resolve(undefined));

    const category = await service.findActive(CATEGORY_ID);

    assert.equal(category, undefined);
  });
});

// FR-007: the catalog filters offer only active categories.
describe('CategoriesService.listActive', () => {
  test('leaves out inactive categories', async () => {
    const { service, categoriesRepository } = makeService();
    const active = aCategory();
    const inactive = aCategory({ id: OTHER_CATEGORY_ID, name: 'Lectures', isActive: false });
    categoriesRepository.findAll.mock.mockImplementation(() => Promise.resolve([active, inactive]));

    const categories = await service.listActive();

    assert.deepEqual(categories, [active]);
  });
});

describe('CategoriesService.getById', () => {
  test('rejects an unknown id with NOT_FOUND', async () => {
    const { service, categoriesRepository } = makeService();
    categoriesRepository.findById.mock.mockImplementation(() => Promise.resolve(undefined));

    await assert.rejects(service.getById(CATEGORY_ID), isDomainError('NOT_FOUND'));
  });
});

// FR-029
describe('CategoriesService.update', () => {
  test('rejects an unknown id with NOT_FOUND and saves nothing', async () => {
    const { service, categoriesRepository } = makeService();
    categoriesRepository.findById.mock.mockImplementation(() => Promise.resolve(undefined));

    await assert.rejects(service.update(CATEGORY_ID, { name: 'Lectures' }), isDomainError('NOT_FOUND'));
    assert.equal(categoriesRepository.update.mock.callCount(), 0);
  });
});

// FR-029
describe('CategoriesService.delete', () => {
  test('rejects an unknown id with NOT_FOUND and deletes nothing', async () => {
    const { service, categoriesRepository } = makeService();
    categoriesRepository.findById.mock.mockImplementation(() => Promise.resolve(undefined));

    await assert.rejects(service.delete(CATEGORY_ID), isDomainError('NOT_FOUND'));
    assert.equal(categoriesRepository.delete.mock.callCount(), 0);
  });
});
