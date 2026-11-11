# CI Metrics Collector

[`collect.mjs`](collect.mjs) collects every run of the `CI` workflow ([`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)) on `main` from the GitHub REST API and writes the raw data and the table of [`docs/ci-cd/metrics-raw.md`](../../docs/ci-cd/metrics-raw.md). It only reads: it creates no workflow and starts nothing in Actions.

## Running It

Node.js 26, no build and no dependencies. The token comes from `GITHUB_TOKEN`, otherwise from `gh auth token`; without either the script stops with an error.

```bash
# The full history, as committed in docs/ci-cd/
node scripts/ci-metrics/collect.mjs --out docs/ci-cd/evidence --table docs/ci-cd/metrics-raw.md \
  --notes docs/ci-cd/evidence/notes.json

# One period, into a scratch folder
node scripts/ci-metrics/collect.mjs --from 2026-10-20 --to 2026-11-09 --out /tmp/ci-metrics
```

| Option | Default | Meaning |
|---|---|---|
| `--from`, `--to` | the whole history | UTC dates of run creation, inclusive |
| `--out` | `ci-metrics-out` | Folder for `runs.json`, and for `metrics-raw.md` unless `--table` is given |
| `--table` | `<out>/metrics-raw.md` | Path of the generated table |
| `--notes` | none | JSON with the Note column, status overrides and evidence file names, keyed by `<run id>/<attempt>` |
| `--repo` | the `origin` remote | `OWNER/NAME` |

The full history takes about a minute and some 800 API requests, well under the hourly limit of 5,000.

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

## AI Usage Note

The script and this README were written with Claude Code. The output for 20.10–09.11 was checked row by row against the table collected by hand for that period. Reviewed by the team.
