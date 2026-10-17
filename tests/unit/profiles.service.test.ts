// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ageOn } from '../../dist/core/profiles/services/profiles.service.js';

describe('ageOn', () => {
  const cases = [
    { today: '2026-10-15', dateOfBirth: '2008-10-15', age: 18, title: 'counts the birthday itself as a full year' },
    { today: '2026-10-14', dateOfBirth: '2008-10-15', age: 17, title: 'stays a year younger the day before' },
    { today: '2026-10-15', dateOfBirth: '2008-11-01', age: 17, title: 'stays a year younger before a later month' },
    { today: '2026-10-15', dateOfBirth: '2008-03-20', age: 18, title: 'counts a birthday in an earlier month' },
    // The same rule as registration: a 29 February birthday counts from 1 March (SAFE-001).
    { today: '2026-02-28', dateOfBirth: '2008-02-29', age: 17, title: 'waits for 1 March after a 29 February birth' },
    { today: '2026-03-01', dateOfBirth: '2008-02-29', age: 18, title: 'counts a 29 February birthday on 1 March' },
    { today: '2028-02-29', dateOfBirth: '2008-02-29', age: 20, title: 'counts a 29 February birthday in a leap year' },
    { today: '2026-10-15', dateOfBirth: '2026-10-15', age: 0, title: 'gives 0 on the day of birth' },
  ];

  for (const { today, dateOfBirth, age, title } of cases) {
    test(title, () => {
      assert.equal(ageOn(today, dateOfBirth), age);
    });
  }
});
