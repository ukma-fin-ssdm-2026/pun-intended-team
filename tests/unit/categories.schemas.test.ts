// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { CreateCategoryBody } from '../../dist/api/catalog/schemas/categories.js';
import { rejectedPaths } from './fixtures/schemas.ts';

const NAME_MAX = 60;

function aCreateCategoryBody(overrides: { name?: string; isActive?: boolean } = {}) {
  return { name: 'Workshops', isActive: true, ...overrides };
}

// FR-029
describe('CreateCategoryBody', () => {
  const accepted = [
    { label: 'a name of 1 character', name: 'a' },
    { label: `a name of ${NAME_MAX} characters`, name: 'a'.repeat(NAME_MAX) },
  ];

  for (const { label, name } of accepted) {
    test(`accepts ${label}`, () => {
      const body = aCreateCategoryBody({ name });

      const result = CreateCategoryBody.safeParse(body);

      assert.equal(result.success, true);
      assert.deepEqual(result.data, body);
    });
  }

  const rejected = [
    { label: 'an empty name', name: '' },
    { label: 'a name of spaces only', name: '   ' },
    { label: `a name of ${NAME_MAX + 1} characters`, name: 'a'.repeat(NAME_MAX + 1) },
  ];

  for (const { label, name } of rejected) {
    test(`rejects ${label} and points at name`, () => {
      const result = CreateCategoryBody.safeParse(aCreateCategoryBody({ name }));

      assert.deepEqual(rejectedPaths(result), [['name']]);
    });
  }
});
