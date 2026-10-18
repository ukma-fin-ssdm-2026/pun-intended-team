import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canApply } from '../../dist/core/matching/services/application-status.js';

test('can apply with no previous applications', () => {
  assert.equal(canApply([]), true);
});

test('can apply if a previous applications is withdrawn', () => {
  assert.equal(canApply(['withdrawn']), true);
});

test('cannot apply while one of the applications is in pool', () => {
  assert.equal(canApply(['withdrawn', 'in_pool']), false);
});
