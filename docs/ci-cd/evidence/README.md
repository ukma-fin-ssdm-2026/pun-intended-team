# CI Metrics: Evidence

Evidence for every row of [`metrics-raw.md`](../metrics-raw.md), collected on 2026-11-11.

| File | What it holds |
|---|---|
| [`runs.json`](runs.json) | Output of [`scripts/ci-metrics/collect.mjs`](../../../scripts/ci-metrics/): every run of `CI` on `main` with its attempts and jobs, the PR of each commit and the PR's commits. Each table row is in `rows`, found by `run_id` and `run_attempt`; its row number is `number` |
| [`notes.json`](notes.json) | The manual part of the table: the Note column, status overrides and the cause of each red attempt, keyed by `<run id>/<attempt>` |
| [`dora-metrics.json`](dora-metrics.json) | The DORA metrics of the full history, 12.09–11.11.2026, computed by `collect.mjs --metrics` from `runs.json` |
| [`dora-metrics-2026-10-20-to-2026-11-09.json`](dora-metrics-2026-10-20-to-2026-11-09.json) | The same for the runs created 20.10–09.11.2026 (rows №117–№210), the period of [`dora-summary.md`](../dora-summary.md): `--metrics --from 2026-10-20 --to 2026-11-09`, no other filters |

A red attempt is one with conclusion `failure` or `timed_out`, or `cancelled` after a job had started. The cause of every red attempt is in the Note column of the table, and in `note` and `cause` of its row in `runs.json`. A job that never got a runner has no log on GitHub; its cause comes from the job annotation:

- runs 379–451 (№89–114): GitHub did not start the job because of the account's payments or spending limit;
- run 586 (№161): the `staging` environment rules rejected `main`;
- runs 614 and 618 (№171, №172): the jobs that waited were cancelled by hand.

## AI Usage Note

The data was collected by Claude Code from the GitHub Actions API; each cause was checked against the job log or the annotation. Reviewed by the team.
