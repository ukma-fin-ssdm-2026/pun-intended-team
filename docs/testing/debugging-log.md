# Debugging Log

The debugging challenge of Lab 6: a realistic bug was put into a tested module on purpose, found with the tests and fixed, and a regression test now guards it. The five steps are the ones from the lab: reproduce, isolate, diagnose, fix, prevent.

Module: `EventsService.list` ([`src/core/catalog/services/events.service.ts`](../../src/core/catalog/services/events.service.ts)), which limits the catalog to the coming 28 days (FR-006, FR-007; [catalog access](../architecture/mechanisms/catalog-access.md), rule 2). Issue: #206.

## Symptom

After the change, 3 of the 130 unit tests failed and the other 127 passed:

```text
not ok 2 - moves a start in the past to today
not ok 3 - moves an end beyond the window to its end
not ok 4 - keeps dates inside the window
# tests 130
# pass 127
# fail 3
```

The failure in the third test shows what a client would see. The catalog window ends on 12 November 2026 (today, 15 October, plus 28 days), and a request with `to=2026-12-31` was passed to the repository unchanged:

```text
Expected values to be strictly deep-equal:
+ actual - expected
  [ { from: '2026-10-20',
+     to: '2026-12-31'
-     to: '2026-11-12'
```

For a user of the app this means two wrong things: a request for events "until 31 December" returned events weeks beyond the 28-day window, and a request for events "until 25 October" ignored the date and returned everything up to the end of the window.

## Reproduce

Build, then run the unit tests, which import the compiled code from `dist/`:

```bash
npm run test:unit
```

The failure repeats on every run, because the tests fix the clock (`useFixedClock`) and the dates. Nothing depends on the real date, the order of tests or a database, so there is no flaky behaviour to rule out.

## Isolate

1. The failing tests are all in one `describe`: `EventsService.list`. Every other test passes, including the ones for the other methods of `EventsService`, so the fault is in `list` or in what it calls.
2. Inside that `describe`, the tests that fail all send a `to`; the tests that send no dates pass. Running only this `describe`:

   ```bash
   npm run build && node --test --test-name-pattern="EventsService.list" tests/unit/events.service.test.ts
   ```

   shows the same 3 failures out of its 6 tests, so the other test files and the build are not involved.
3. The service has two moving parts here: the repository, which the tests replace with a mock, and the date arithmetic in `list`. Every failing assertion is about the arguments passed to the mock (`from`, `to`), not about the result, so the mock is not the cause. What is left is the lines that compute `from` and `to`.

## Diagnose

`list` computes the dates from the query, today and the window end:

```ts
const from = query.from && query.from > today ? query.from : today;
const to = query.to && query.to > windowEnd ? query.to : windowEnd; // the injected line
```

The two lines must mirror each other. For `from`, a date before today is replaced by today, so the later of the two wins (`>` is right). For `to`, a date after the window end is replaced by the window end, so the **earlier** of the two must win, and the comparison must be `<`. With `>` the line returns the later date: `to=2026-12-31` stays `2026-12-31`, and `to=2026-10-25` is replaced by `2026-11-12`. That is exactly the actual-versus-expected difference in the output above.

The cause is a flipped comparison operator, a one-character change, probably from copying the `from` line and not reversing the condition. It is the kind of slip a quick review does not notice, because both lines look right on their own. No other file had to change.

The dates are strings in the `YYYY-MM-DD` form, so `<` and `>` compare them correctly; the bug is not in the string comparison.

## Fix

One character, back to the original line:

```ts
const to = query.to && query.to < windowEnd ? query.to : windowEnd;
```

After the fix `npm run test:unit` passes in full (134 of 134: the 130 from before and the 4 new tests below).

The regression test was written **before** the fix and run against the broken code, to check that it really reproduces the failure: 3 of its 4 cases failed there, and all 4 pass now.

## Regression test

[`tests/unit/events.service.test.ts`](../../tests/unit/events.service.test.ts), `EventsService.list`, the four tests named `end date: …`:

| Test | `to` sent | Passed to the repository | Fails with the bug |
|---|---|---|---|
| `keeps the last day of the window` | `2026-11-12` | `2026-11-12` | no |
| `keeps the day before the last day of the window` | `2026-11-11` | `2026-11-11` | yes |
| `moves the day after the window to its last day` | `2026-11-13` | `2026-11-12` | yes |
| `moves a date a year ahead to the last day of the window` | `2027-10-15` | `2026-11-12` | yes |

The first case guards the edge itself: the last day of the window must be kept, so it would also catch a window that is one day too short. With the flipped operator it passes by luck, because the two dates are equal. The old tests used `2026-10-20`, `2026-10-25` and `2026-12-31`, never a day next to the last day of the window, where an off-by-one would show first. The new cases do.

## Lesson

- **Test a boundary from both sides.** The earlier tests had one value on each side of the rule and nothing next to the edge. The new table checks the last day, the day before and the day after.
- **One condition per test.** Each old case set `from` and `to` together, so a failing case did not say which of the two lines was wrong, and the isolation step had to compare the cases by hand. The new cases send only `to`, so a failure names the line.
- **The tests found the bug in under a minute because they are deterministic.** A fixed clock, fixed dates and a mocked repository made the failure the same every time, and the assertion message already showed expected and actual values. The mock also made the isolation step short: the failure was in the arguments, not in storage.
- **Next time:** run the unit tests before the integration tests when something about the catalog looks wrong. They finish in seconds and point at a line. The integration tests need the database, so they would have told us only that a response was wrong.
- **What the tests cannot prove:** a green suite shows that the cases we thought of pass. Mutation testing (Stryker, planned in the [testing strategy](testing-strategy.md)) would check this directly, because changing a comparison operator is one of its standard mutations.

## Commits

The challenge was kept as separate commits on the branch of #206, so the steps can be read from the history:

1. `(#206) Inject a bug into the catalog window`: the flipped operator, the suite goes red.
2. `(#206) Add regression tests for the window end`: the new tests fail on the broken code.
3. `(#206) Fix the window end comparison`: the suite is green again.
4. `(#206) Write the debugging log`: this file.

## AI Usage Note

The bug, the regression tests and this log were prepared with Claude. Claude ran the tests before the change, with the bug, with only the new tests on the broken code and after the fix; the outputs quoted above come from those runs. Oleh repeated the steps in the repository and reviewed the text.
