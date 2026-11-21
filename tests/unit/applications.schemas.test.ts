// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { CreateApplicationBody } from '../../dist/api/matching/schemas/applications.js';
import { MIN_PREFERRED_AGE } from '../../dist/core/matching/types/application.js';
import { rejectedPaths } from './fixtures/schemas.ts';

function aBody(overrides: Record<string, unknown> = {}) {
  return { desiredCompany: 'company', afterEventPlans: ['walk'], ...overrides };
}

// Whom the user wants to go with (matching.md, policy).
describe('CreateApplicationBody', () => {
  test('accepts anyone of any age when the preferences are left out', () => {
    const result = CreateApplicationBody.safeParse(aBody());

    assert.equal(result.success, true);
    assert.deepEqual(
      [result.data?.preferredGender, result.data?.ageMin, result.data?.ageMax],
      ['any', MIN_PREFERRED_AGE, null],
    );
  });

  for (const preferredGender of ['any', 'female', 'male'] as const) {
    test(`accepts the preferred gender ${preferredGender}`, () => {
      const result = CreateApplicationBody.safeParse(aBody({ preferredGender }));

      assert.equal(result.data?.preferredGender, preferredGender);
    });
  }

  const acceptedRanges = [
    { label: 'a range from 18', ageMin: MIN_PREFERRED_AGE, ageMax: 30 },
    { label: 'a range of one year', ageMin: 30, ageMax: 30 },
    { label: 'a range without an upper bound', ageMin: 60, ageMax: null },
  ];

  for (const { label, ageMin, ageMax } of acceptedRanges) {
    test(`accepts ${label}`, () => {
      const result = CreateApplicationBody.safeParse(aBody({ ageMin, ageMax }));

      assert.equal(result.success, true);
      assert.deepEqual([result.data?.ageMin, result.data?.ageMax], [ageMin, ageMax]);
    });
  }

  const rejected = [
    { label: 'the gender "other" as a preference', body: { preferredGender: 'other' }, path: 'preferredGender' },
    { label: 'a youngest age under 18', body: { ageMin: MIN_PREFERRED_AGE - 1 }, path: 'ageMin' },
    { label: 'an oldest age under 18', body: { ageMin: 18, ageMax: 17 }, path: 'ageMax' },
    { label: 'an oldest age below the youngest', body: { ageMin: 30, ageMax: 25 }, path: 'ageMax' },
    { label: 'an age that is not a whole number', body: { ageMin: 20.5 }, path: 'ageMin' },
  ];

  for (const { label, body, path } of rejected) {
    test(`rejects ${label} and points at ${path}`, () => {
      const paths = rejectedPaths(CreateApplicationBody.safeParse(aBody(body)));

      assert.ok(
        paths.some((issuePath) => issuePath.join('.') === path),
        JSON.stringify(paths),
      );
    });
  }
});
