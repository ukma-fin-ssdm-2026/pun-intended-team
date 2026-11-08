// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import { DomainError } from '../../dist/core/common/domain-error.js';
import type { CategoriesRepository } from '../../dist/core/catalog/repositories/categories.repository.js';
import { CategoriesService } from '../../dist/core/catalog/services/categories.service.js';
import { normalizeCategoryName } from '../../dist/core/catalog/services/category-name.js';
import type { Category, CategoryChanges, NewCategory } from '../../dist/core/catalog/types/category.js';
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
    create: mock.fn((category: NewCategory) => Promise.resolve(aCategory({ id: OTHER_CATEGORY_ID, ...category }))),
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
  test('returns the category with that id', async () => {
    const { service, categoriesRepository } = makeService();

    const category = await service.getById(CATEGORY_ID);

    assert.deepEqual(categoriesRepository.findById.mock.calls[0]?.arguments, [CATEGORY_ID]);
    assert.deepEqual(category, aCategory());
  });

  test('rejects an unknown id with NOT_FOUND', async () => {
    const { service, categoriesRepository } = makeService();
    categoriesRepository.findById.mock.mockImplementation(() => Promise.resolve(undefined));

    await assert.rejects(service.getById(CATEGORY_ID), isDomainError('NOT_FOUND'));
  });
});

// FR-029
describe('CategoriesService.create', () => {
  test('saves the category with a slug made from its name', async () => {
    const { service, categoriesRepository } = makeService();

    const category = await service.create({ name: 'Майстер-класи', isActive: true });

    assert.deepEqual(categoriesRepository.create.mock.calls[0]?.arguments, [
      { name: 'Майстер-класи', isActive: true, slug: 'maister-klasy' },
    ]);
    assert.equal(category.slug, 'maister-klasy');
  });

  test('adds a number to a slug another category has', async () => {
    const { service, categoriesRepository } = makeService();
    categoriesRepository.findAll.mock.mockImplementation(() =>
      Promise.resolve([aCategory({ slug: 'kino' }), aCategory({ id: OTHER_CATEGORY_ID, slug: 'kino-2' })]),
    );

    await service.create({ name: 'Кіно!', isActive: true });

    assert.equal(categoriesRepository.create.mock.calls[0]?.arguments[0].slug, 'kino-3');
  });

  test('saves the name normalized and makes the slug from it', async () => {
    const { service, categoriesRepository } = makeService();

    await service.create({ name: "  Кав'ярні   міста ", isActive: true });

    const [saved] = categoriesRepository.create.mock.calls[0]?.arguments ?? [];
    assert.deepEqual([saved?.name, saved?.slug], ['Кавʼярні міста', 'kaviarni-mista']);
  });

  test('ignores a slug sent with the input', async () => {
    const { service, categoriesRepository } = makeService();
    const input = { name: 'Кіно', isActive: true, slug: 'my-own' } as Parameters<CategoriesService['create']>[0];

    await service.create(input);

    assert.equal(categoriesRepository.create.mock.calls[0]?.arguments[0].slug, 'kino');
  });
});

// FR-029
describe('CategoriesService.update', () => {
  test('saves the changes under the id and returns the saved category', async () => {
    const { service, categoriesRepository } = makeService();
    const changes: CategoryChanges = { name: 'Lectures', isActive: false };
    const saved = aCategory({ name: 'Lectures', isActive: false });
    categoriesRepository.update.mock.mockImplementation(() => Promise.resolve(saved));

    const category = await service.update(CATEGORY_ID, changes);

    assert.deepEqual(categoriesRepository.update.mock.calls[0]?.arguments, [CATEGORY_ID, changes]);
    assert.equal(category, saved);
  });

  test('saves a new name normalized', async () => {
    const { service, categoriesRepository } = makeService();

    await service.update(CATEGORY_ID, { name: 'Кав’ярні  міста' });

    assert.equal(categoriesRepository.update.mock.calls[0]?.arguments[1].name, 'Кавʼярні міста');
  });

  test('never passes a slug on, so a rename keeps it', async () => {
    const { service, categoriesRepository } = makeService();
    const changes = { name: 'Лекції', slug: 'lektsii' } as CategoryChanges;

    await service.update(CATEGORY_ID, changes);

    const [, saved] = categoriesRepository.update.mock.calls[0]?.arguments ?? [];
    assert.equal(saved?.name, 'Лекції');
    assert.ok(!('slug' in (saved ?? {})));
  });

  test('rejects an unknown id with NOT_FOUND and saves nothing', async () => {
    const { service, categoriesRepository } = makeService();
    categoriesRepository.findById.mock.mockImplementation(() => Promise.resolve(undefined));

    await assert.rejects(service.update(CATEGORY_ID, { name: 'Lectures' }), isDomainError('NOT_FOUND'));
    assert.equal(categoriesRepository.update.mock.callCount(), 0);
  });
});

// FR-029
describe('CategoriesService.delete', () => {
  test('deletes the category with that id', async () => {
    const { service, categoriesRepository } = makeService();

    await service.delete(CATEGORY_ID);

    assert.deepEqual(categoriesRepository.delete.mock.calls[0]?.arguments, [CATEGORY_ID]);
  });

  test('rejects an unknown id with NOT_FOUND and deletes nothing', async () => {
    const { service, categoriesRepository } = makeService();
    categoriesRepository.findById.mock.mockImplementation(() => Promise.resolve(undefined));

    await assert.rejects(service.delete(CATEGORY_ID), isDomainError('NOT_FOUND'));
    assert.equal(categoriesRepository.delete.mock.callCount(), 0);
  });
});

describe('normalizeCategoryName', () => {
  const cases = [
    { name: 'Кіно', normalized: 'Кіно', title: 'keeps a name with nothing to change, case included' },
    { name: '  Кіно  ', normalized: 'Кіно', title: 'trims spaces at the ends' },
    { name: 'Дні   відкритих\tдверей', normalized: 'Дні відкритих дверей', title: 'makes a run of spaces one' },
    { name: "Кав'ярні", normalized: 'Кавʼярні', title: 'writes a typewriter apostrophe as ʼ' },
    { name: 'Кав’ярні', normalized: 'Кавʼярні', title: 'writes a right quotation mark as ʼ' },
    { name: 'Кавʼярні', normalized: 'Кавʼярні', title: 'keeps ʼ' },
  ];

  for (const { name, normalized, title } of cases) {
    test(title, () => {
      assert.equal(normalizeCategoryName(name), normalized);
    });
  }
});
