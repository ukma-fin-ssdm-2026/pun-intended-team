import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canApply } from '../../dist/core/matching/services/application-status.js';

test('can apply with no previous applications', () => {
  assert.equal(canApply([]), true);
});
