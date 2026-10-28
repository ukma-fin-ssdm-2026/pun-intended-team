// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { PageQuery } from '../../dist/api/common/schemas/common.js';
import { rejectedPaths } from './fixtures/schemas.ts';

// Catalog access, rule 2: no page holds more than 20 items.
const MAX_PAGE_SIZE = 20;

describe('PageQuery', () => {
  test(`defaults to a limit of ${MAX_PAGE_SIZE} and an offset of 0`, () => {
    const result = PageQuery.safeParse({});

    assert.equal(result.success, true);
    assert.deepEqual(result.data, { limit: MAX_PAGE_SIZE, offset: 0 });
  });

  for (const limit of [1, MAX_PAGE_SIZE]) {
    test(`accepts a limit of ${limit}`, () => {
      const result = PageQuery.safeParse({ limit: String(limit) });

      assert.equal(result.success, true);
      assert.deepEqual(result.data, { limit, offset: 0 });
    });
  }

  const rejectedLimits = [
    { label: 'a limit of 0', limit: '0' },
    { label: `a limit of ${MAX_PAGE_SIZE + 1}`, limit: String(MAX_PAGE_SIZE + 1) },
    { label: 'a fractional limit', limit: '1.5' },
    { label: 'a limit that is not a number', limit: 'abc' },
  ];

  for (const { label, limit } of rejectedLimits) {
    test(`rejects ${label} and points at limit`, () => {
      const result = PageQuery.safeParse({ limit });

      assert.deepEqual(rejectedPaths(result), [['limit']]);
    });
  }

  test('accepts an offset of 0', () => {
    const result = PageQuery.safeParse({ offset: '0' });

    assert.equal(result.success, true);
    assert.deepEqual(result.data, { limit: MAX_PAGE_SIZE, offset: 0 });
  });

  const rejectedOffsets = [
    { label: 'a negative offset', offset: '-1' },
    { label: 'a fractional offset', offset: '1.5' },
  ];

  for (const { label, offset } of rejectedOffsets) {
    test(`rejects ${label} and points at offset`, () => {
      const result = PageQuery.safeParse({ offset });

      assert.deepEqual(rejectedPaths(result), [['offset']]);
    });
  }
});
