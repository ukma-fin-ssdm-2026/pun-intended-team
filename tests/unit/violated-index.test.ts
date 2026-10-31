// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { violatedIndex } from '../../dist/infra/prisma/violated-index.js';
import { aUniqueViolation } from './fixtures/prisma-errors.ts';

const INDEX = 'auth_methods_type_secret_key';

describe('violatedIndex', () => {
  test('names the unique index a write ran into', () => {
    assert.equal(violatedIndex(aUniqueViolation()), INDEX);
  });

  const notUniqueViolations = [
    { title: 'is undefined for another Prisma error', error: aUniqueViolation({ code: 'P2025' }) },
    { title: 'is undefined for an error that is not from Prisma', error: new Error('connection refused') },
    { title: 'is undefined when the adapter names no index', error: aUniqueViolation({ index: null }) },
  ];

  for (const { title, error } of notUniqueViolations) {
    test(title, () => {
      assert.equal(violatedIndex(error), undefined);
    });
  }
});
