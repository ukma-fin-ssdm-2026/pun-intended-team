// Written with the help of Claude
// Unit tests for interestOverlap, the match score (docs/architecture/mechanisms/matching.md).
// They import the built code from dist/, like the other unit tests.
// Run with `npx nest build && node --test tests/unit/interest-overlap.test.ts`.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { interestOverlap } from '../../dist/core/matching/services/interest-overlap.js';

describe('interestOverlap', () => {
  test('identical lists score 1', () => {
    assert.equal(interestOverlap(['hiking', 'jazz', 'board games'], ['hiking', 'jazz', 'board games']), 1);
  });
});
