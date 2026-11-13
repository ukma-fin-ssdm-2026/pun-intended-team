# CI Metrics Collector

[`collect.mjs`](collect.mjs) collects every run of the `CI` workflow ([`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)) on `main` from the GitHub REST API and writes the raw data and the table of [`docs/ci-cd/metrics-raw.md`](../../docs/ci-cd/metrics-raw.md). With `--metrics` it reads that raw data back and computes the four DORA metrics into [`docs/ci-cd/evidence/dora-metrics.json`](../../docs/ci-cd/evidence/dora-metrics.json). It only reads: it creates no workflow and starts nothing in Actions.

## Running It

Node.js 26, no build and no dependencies. Collecting needs a token: `GITHUB_TOKEN`, otherwise `gh auth token`; without either the script stops with an error. `--metrics` needs no token.

```bash
# 1. The full history, as committed in docs/ci-cd/
node scripts/ci-metrics/collect.mjs --out docs/ci-cd/evidence --table docs/ci-cd/metrics-raw.md \
  --notes docs/ci-cd/evidence/notes.json

# 2. The DORA metrics from that runs.json, as committed in docs/ci-cd/evidence/dora-metrics.json
node scripts/ci-metrics/collect.mjs --metrics --out docs/ci-cd/evidence --notes docs/ci-cd/evidence/notes.json

# One period, into a scratch folder (ci-metrics-out/ is ignored by git); the metrics read the runs.json
# written by the first command
node scripts/ci-metrics/collect.mjs --from 2026-10-20 --to 2026-11-09 --out ci-metrics-out/period
node scripts/ci-metrics/collect.mjs --metrics --out ci-metrics-out/period

# The metrics of a period from the committed full history, with the team's filters
node scripts/ci-metrics/collect.mjs --metrics --out docs/ci-cd/evidence --notes docs/ci-cd/evidence/notes.json \
  --from 2026-10-20 --to 2026-11-09 --exclude-runs 1-60 --ignore-failure-causes billing
```

| Option | Default | Meaning |
|---|---|---|
| `--from`, `--to` | the whole history | UTC dates of run creation, inclusive. With `--metrics`, they select rows of `runs.json` |
| `--out` | `ci-metrics-out` | Folder for `runs.json`, and for `metrics-raw.md` unless `--table` is given. With `--metrics`, the folder that holds `runs.json` and receives `dora-metrics.json` |
| `--table` | `<out>/metrics-raw.md` | Path of the generated table |
| `--notes` | none | JSON with the Note column, status overrides and failure causes, keyed by `<run id>/<attempt>` (see below) |
| `--repo` | the `origin` remote | `OWNER/NAME` |
| `--metrics` | off | Compute the metrics from `<out>/runs.json` instead of calling the API |
| `--exclude-runs` | none | Row numbers (the № column) to leave out of the metrics entirely, e.g. `1-60,89` |
| `--ignore-failure-causes` | none | Causes from `--notes`, comma-separated, whose red runs count as neither a deployment nor a failure |

Run it from the repository root: `--out`, `--table` and `--notes` are resolved against the working directory and must stay inside it, otherwise the script stops. API URLs are built from the API origin with encoded path segments and query parameters; the token goes only into the `Authorization` header and is never printed.

The full history takes about a minute and some 800 API requests, well under the hourly limit of 5,000.

### `notes.json`

The table cannot be generated from the API alone: the Note column, a status GitHub reports differently from what happened, and the cause of each red run are written by hand. They live in one file so that a regeneration keeps them:

```json
{
  "attempts": {
    "42475724874/1": {
      "note": "`Reliability tests` hit the 10-minute job timeout; GitHub shows the run as cancelled",
      "status": "failure",
      "cause": "timeout"
    }
  }
}
```

| Field | Meaning |
|---|---|
| `note` | The Note column, verbatim |
| `status` | Overrides the attempt's conclusion in the Status column and in the metrics |
| `cause` | A short tag for a red run, the value `--ignore-failure-causes` matches: `billing`, `ghcr-denied`, `build-arg`, `environment-rules`, `timeout`, `flaky-test`, `manual-cancel` |

## What It Collects

1. All runs from `GET /repos/{owner}/{repo}/actions/workflows/ci.yml/runs?branch=main`, page by page. Runs by `dependabot[bot]` and `pull_request` runs (a fork's branch can also be called `main`) are left out.
2. For each attempt of a run, `GET /actions/runs/{id}/attempts/{n}` and `/attempts/{n}/jobs`. The run itself shows only its last attempt, so each re-run is a row of its own.
3. For each commit, `GET /commits/{sha}/pulls` and `GET /commits/{sha}`. When two PRs are merged within a second, GitHub can link a merge commit to no PR; the script then takes the PR from the merge commit's message (`Merge pull request #N`), but only if that PR was merged into `main` and its head is a parent of the commit.
4. For each PR, `GET /pulls/{n}/commits`.

`runs.json` keeps all of it: `rows` (one per table row), `runs` with their attempts and jobs, `commits` and `pulls`. Steps are kept only for jobs that did not pass.

## Columns

All times are UTC, `DD.MM HH:MM`; minutes are rounded to one decimal, half up.

| Column | Source |
|---|---|
| № | Row number in order of run creation, then attempt |
| Commit | Short SHA of `head_sha`, linked to the run |
| PR | The PR the commit came from; `—` for a direct push |
| First PR commit | Earliest `author.date` among the PR's commits; for a direct push, the commit's own `author.date` |
| Run completed | Completion of the attempt's last job; the attempt's `updated_at` when no job ran. `—` for a run cancelled before any job started |
| Queue, min | From the start of the attempt (`run_started_at`) to the start of its first job |
| Execution, min | From the start of the first job to the completion of the attempt's last job |
| Status | ✅ `success`, ❌ `failure` or `timed_out`, ⏹️ `cancelled`; `--notes` can override it |
| Note | From `--notes` |

### Queue and Execution

- Only jobs that ran count. A skipped job never runs. A job counts as started when it got a runner (`runner_name`) or has steps; a job that waited for an environment without a runner has a `started_at` but did not start.
- In a re-run, the jobs that were not re-run are listed again with their times from the earlier attempt. Only jobs that started after the attempt's `run_started_at` count, so a re-run's queue starts with the re-run, not with the first attempt.
- A job that waits for an environment and is then cancelled still has a `completed_at`, so its wait is part of the execution.
- When no job started (a run cancelled while queued, or a job GitHub refused to start), queue and execution are empty.

## Metrics

`--metrics` follows the lab's definitions. Every row of the table is one run; each attempt of a re-run is a run of its own, as in the table.

| Row | Counts as |
|---|---|
| ✅ `success` | a deployment |
| ❌ `failure`, `timed_out` (after `--notes` overrides, so №202 is red) | a failure |
| ⏹️ `cancelled`, whether before or after a job started | neither: not a deployment, not a failure, not in the fail-rate denominator |
| a red run whose `cause` is in `--ignore-failure-causes` | neither, like a cancelled run; its PR still gets a lead time |
| a row in `--exclude-runs` | left out of everything, including the lead times |

| Metric | How it is computed |
|---|---|
| Deployment frequency | deployments ÷ days of the period, also per week (days ÷ 7). The period is `--from`..`--to`, otherwise the period `runs.json` was collected for, otherwise from the first run's creation date to the collection date |
| Change lead time | One value per change: a PR, or a commit pushed directly. From the PR's first commit (the commit itself for a direct push) to the completion of the first green run created at or after the change's own first run on `main`; `main` is linear, so every later run contains the commit. A change whose run was red or cancelled is therefore measured to the next green run. A change with no green run yet is listed under `pending`. The queue is part of the lead time; `shares_percent` splits the total into the time before the green run started (`before_run`), its `queue` and its `execution` |
| Change fail rate | failures ÷ (deployments + failures) |
| Failed deployment recovery time | One incident from a red run while `main` is green to the next green run; red runs in between belong to the same incident and are listed in it. The duration runs from the first red run's completion to the green run's completion. An incident without a green run yet is listed under `unresolved` |

Means and medians are in minutes with a readable `_text` next to them. `dora-metrics.json` also holds the applied filters, the row numbers behind every count (`classification`), the per-change lead times (`change_lead_time.items`) and the incidents (`failed_deployment_recovery_time.items`), so each number can be checked against the table by hand. It holds no DORA categories or benchmarks; those are in `dora-summary.md`.

For 20.10–09.11 without filters the script gives the numbers of `dora-summary.md` to the minute: 27 deployments a week, lead time mean 30 h 10 min and median 5 h 23 min over 89 changes, 6 failures of 87, recovery mean 4 h 10 min and median 1 h 11 min over 4 incidents.

## AI Usage Note

The script and this README were written with Claude Code. The output for 20.10–09.11 was checked row by row against the table collected by hand for that period, and the metrics against the summary computed by hand. Reviewed by the team.
