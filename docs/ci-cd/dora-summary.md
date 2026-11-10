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

## AI Usage Note

The metrics were computed by Claude Code from the collected run data, following the lab's definitions. Reviewed by the team.
