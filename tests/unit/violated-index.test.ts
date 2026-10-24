// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { Prisma } from '../../dist/infra/prisma/generated/client.js';
import { violatedIndex } from '../../dist/infra/prisma/violated-index.js';

const INDEX = 'auth_methods_type_secret_key';

/** The error Prisma's pg adapter throws when a write runs into `index`, as seen from Prisma 7.10. */
function aUniqueViolation({ code = 'P2002', index = INDEX as unknown } = {}): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code,
    clientVersion: '7.10.0',
    meta: {
      driverAdapterError: {
        name: 'DriverAdapterError',
        cause: { kind: 'UniqueConstraintViolation', constraint: { index } },
      },
    },
  });
}

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
