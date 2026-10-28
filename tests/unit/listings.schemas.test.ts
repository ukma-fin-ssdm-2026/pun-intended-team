// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { CreateListingBody } from '../../dist/api/listings/schemas/listings.js';
import type { CreateListingBody as CreateListing } from '../../src/api/listings/schemas/listings.ts';
import { TODAY } from './fixtures/clock.ts';
import { CATEGORY_ID, EVENT_ID } from './fixtures/catalog.ts';
import { rejectedPaths } from './fixtures/schemas.ts';

const TITLE_MAX = 120;
const DESCRIPTION_MAX = 2000;

function aCreateListingBody(overrides: Partial<CreateListing> = {}): CreateListing {
  return {
    categoryId: CATEGORY_ID,
    eventId: EVENT_ID,
    title: 'Looking for company for the exhibition',
    description: 'Planning to go in the evening.',
    date: TODAY,
    ...overrides,
  };
}

// FR-021
describe('CreateListingBody', () => {
  const accepted = [
    { label: 'a title of 1 character', overrides: { title: 'a' } },
    { label: `a title of ${TITLE_MAX} characters`, overrides: { title: 'a'.repeat(TITLE_MAX) } },
    { label: 'an empty description', overrides: { description: '' } },
    {
      label: `a description of ${DESCRIPTION_MAX} characters`,
      overrides: { description: 'a'.repeat(DESCRIPTION_MAX) },
    },
  ];

  for (const { label, overrides } of accepted) {
    test(`accepts ${label}`, () => {
      const body = aCreateListingBody(overrides);

      const result = CreateListingBody.safeParse(body);

      assert.equal(result.success, true);
      assert.deepEqual(result.data, body);
    });
  }

  test('accepts a description of spaces only as an empty one', () => {
    const body = aCreateListingBody({ description: '   ' });

    const result = CreateListingBody.safeParse(body);

    assert.equal(result.success, true);
    assert.equal(result.data?.description, '');
  });

  const rejected = [
    { label: 'an empty title', field: 'title', overrides: { title: '' } },
    { label: 'a title of spaces only', field: 'title', overrides: { title: '   ' } },
    {
      label: `a title of ${TITLE_MAX + 1} characters`,
      field: 'title',
      overrides: { title: 'a'.repeat(TITLE_MAX + 1) },
    },
    {
      label: `a description of ${DESCRIPTION_MAX + 1} characters`,
      field: 'description',
      overrides: { description: 'a'.repeat(DESCRIPTION_MAX + 1) },
    },
  ];

  for (const { label, field, overrides } of rejected) {
    test(`rejects ${label} and points at ${field}`, () => {
      const result = CreateListingBody.safeParse(aCreateListingBody(overrides));

      assert.deepEqual(rejectedPaths(result), [[field]]);
    });
  }

  test('rejects a body without a description and points at description', () => {
    const body: Partial<CreateListing> = aCreateListingBody();
    delete body.description;

    const result = CreateListingBody.safeParse(body);

    assert.deepEqual(rejectedPaths(result), [['description']]);
  });
});
