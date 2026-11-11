# CI Metrics: Evidence

Evidence for every row of [`metrics-raw.md`](../metrics-raw.md), collected on 2026-11-11.

| File | What it holds |
|---|---|
| [`runs.json`](runs.json) | Output of [`scripts/ci-metrics/collect.mjs`](../../../scripts/ci-metrics/): every run of `CI` on `main` with its attempts and jobs, the PR of each commit and the PR's commits. Each table row is in `rows`, found by `run_id` and `run_attempt`; its row number is `number` |
| [`notes.json`](notes.json) | The manual part of the table: the Note column, status overrides and the evidence file of each red attempt, keyed by `<run id>/<attempt>` |
| `run-<run number>-attempt-<n>.log` | One file per red attempt on `main`: the annotations of the jobs that did not pass and a few dozen lines of the job log around the error |

A red attempt is one with conclusion `failure` or `timed_out`, or `cancelled` after a job had started. Runs cancelled before any job started have no file; the API shows that they had no job.

## How the Logs Were Taken

`gh run view <id> --log-failed` printed nothing for these runs, so the logs come from the job log endpoint, which serves every attempt by job id:

```bash
gh api repos/ukma-fin-ssdm-2026/pun-intended-team/actions/jobs/<job id>/logs
gh api repos/ukma-fin-ssdm-2026/pun-intended-team/check-runs/<job id>/annotations
```

Each file names its source and the line numbers of the excerpt. No log had expired. A job that never got a runner has no log at all (the endpoint answers 404); its file holds only the annotation, which gives the cause:

- runs 379–451 (№89–114): GitHub did not start the job because of the account's payments or spending limit;
- run 586 (№161): the `staging` environment rules rejected `main`;
- runs 614 and 618 (№171, №172): the jobs that waited were cancelled by hand.

## AI Usage Note

The data was collected and the log excerpts cut by Claude Code from the GitHub Actions API; each cause was checked against the log or the annotation. Reviewed by the team.
