# DORA Summary

DORA metrics of the `CI` workflow on `main` from 20.10 to 09.11.2026 (3 weeks), computed from the runs in [`metrics-raw.md`](metrics-raw.md). The per-PR lead times and the recovery incidents are in [`evidence/dora-metrics.json`](evidence/dora-metrics.json).

## DORA Metrics

| Metric | Result | Category |
|---|---|---|
| Deployment frequency | 27 per week | Hourly to daily → 22.7% |
| Change lead time | mean 30 h 10 min, median 5 h 23 min | Under a day → 24.4% |
| Change fail rate | 6.9% (6 of 87) | 4–8% → 36.2% |
| Failed deployment recovery time | mean 4 h 10 min, median 1 h 11 min | Under a day → 56.5% |s

## CI Benchmarks

| Indicator | Recommended | CircleCI 2025 data | Ours |
|---|---|---|---|
| Success rate on `main` | 90% | 70.8% | 81 / 87 = **93.1%** |
| Return of `main` to green | under 60 min | 59.2 min (median) | **70.5 min** (median) |
| Workflow duration | under 10 min | 2.2 min (median) | **2.7 min** (median); 3.0 min with the queue |

## Improvement Backlog

| Metric | Problem | Root cause | Action | Owner |
|---|---|---|---|---|
| Change lead time | 21 of 89 PRs over a day, up to 9 days | Large PRs (up to 100 commits) | Split features into PRs of at most a day's work | @viktoriyabaran |
| Change lead time | 98.9% of lead time is before the merge | PRs wait for review | Review within one working day | @DarynaHalytska |
| Deployment frequency | No deployment on 7 of 21 days | Work done in bursts around lab deadlines | Merge small PRs daily | @viktoriyabaran |
| Deployment frequency | 25 of 88 PRs changed the committed coverage reports; 9 merges of `main` into a branch had to redo them | Generated reports conflict between PRs | Stop committing coverage reports; publish them from CI | @OLEGkn-coder |
| Change fail rate | Flaky rate limit test (№91) | Not yet known | Flaky test hunt: 5 runs of the suite on one commit; quarantine with an issue | @viktoriyabaran |
| Change fail rate | Reliability tests hung until the timeout (№86) | A started process is left open | Stop the started APIs in `after`; `--test-force-exit` | @OLEGkn-coder |
| Recovery time | Red `main` for 14 h (№91) | Nobody watches `main` | Notify the team chat when `main` turns red | @Vlad-Re |

## Bonuses

1. **Automatic collection.** [`scripts/ci-metrics/`](../../scripts/ci-metrics/) takes the runs of `CI` on `main` for a given period from the GitHub Actions API and records the queue and the execution of each attempt separately; its output is [`evidence/runs.json`](evidence/runs.json). Run: `node scripts/ci-metrics/collect.mjs --from 2026-10-20 --to 2026-11-09 --out <folder>`.

## AI Usage Note

The metrics were computed by Claude Code from the collected run data, following the lab's definitions; the improvement backlog were drafted by Claude Code. Reviewed by the team.
