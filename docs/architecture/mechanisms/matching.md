# Matching Flow

## Decision

Users apply to an **event session**. Matching runs in **scheduled rounds** anchored to the session's start time, with an **instant match** for exceptionally good pairs and an **open mode** for latecomers after the last round.

## Rules

1. **Instant match on apply** — only if the top candidate scores above the threshold **and** the two are each other's best option in the current pool. Otherwise the user waits for the next round.
2. **Scheduled rounds** — the whole pool of a session is paired at once, at fixed offsets before the start. Offsets that fall in the past are skipped.
3. **Open mode** — after the last round, newcomers and declined users are matched instantly against the leftovers, until a cutoff before the start.
4. **Proposal lifetime** — valid until the next round (or the cutoff, after the last round). Expiry is computed on read, not by a job.
5. **Decline / expiry** — both users return to the pool. A decline adds the candidate to the decliner's exclusions (FR-020).
6. **Exclusivity** — the instant path and the round job take the same per-session lock before reading the pool, so a candidate is never claimed twice (FUNC-002).
7. **Algorithm** — a pure function `match(pool, exclusions, seed) → pairings`, with no I/O (FUNC-001, MAIN-001).

## Policy (tunable, not architecture)

| Parameter | Draft value |
|---|---|
| Round offsets | T-7d, T-3d, T-24h, T-6h |
| Instant-match threshold | 0.8 interest overlap |
| Open-mode cutoff | T-1h |

Every score is logged so the threshold can be tuned on real data.

## Open

- How long-running events (e.g. a month-long exhibition) are split into sessions.
- Requirement wording to update: FR-017, FR-018, PERF-003, FUNC-002; OQ-004 is resolved by rule 4.

## AI Usage Note

Drafted with Claude from an architecture discussion led by Viktoriia Baran.
