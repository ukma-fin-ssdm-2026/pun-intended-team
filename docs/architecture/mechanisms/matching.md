# Matching Flow

## Decision

Users apply to an **event session**. Matching runs in **scheduled rounds** anchored to the session's start time, with an **instant match** for exceptionally good pairs and an **open mode** for latecomers after the last round.

## Rules

1. **Instant match on apply** — only if the top candidate scores above the threshold **and** the two are each other's best option in the current pool. Otherwise the user waits for the next round.
2. **Scheduled rounds** — the whole pool of a session is paired at once, at fixed offsets before the start. Offsets that fall in the past are skipped.
3. **Open mode** — after the last round, newcomers and declined users are matched instantly against the leftovers, until a cutoff before the start.
4. **Proposal lifetime** — valid for **24 h or until the next round starts, whichever comes first** (after the last round: until the cutoff). Nobody is left in a pending proposal while a round runs without them. A job expires the proposal at `valid_until`.
5. **Decline** — both users return to the pool; the decliner excludes the candidate (FR-020).
6. **Expiry (no response)** — an expired pair is never proposed to each other again for this event.
   - The user who responded returns to the pool for the next round.
   - A user who did not respond gets a **strike** on this application. First strike: paused, asked "continue matching on this event?" — back in the pool only after "yes". Second strike: removed from the pool.
   - If neither responded, both get a strike.
   - A removed user may apply again; the new application starts with no strikes, but pair exclusions remain.
7. **Exclusivity** — the instant path and the round job take the same per-session lock before reading the pool, so a candidate is never claimed twice (FUNC-002).
8. **Algorithm** — a pure function `match(pool, exclusions, seed) → pairings`, with no I/O (FUNC-001, MAIN-001).

## Policy (tunable, not architecture)

| Parameter | Draft value |
|---|---|
| Round offsets | T-7d, T-3d, T-24h, T-6h |
| Instant-match threshold | 0.8 interest overlap |
| Open-mode cutoff | T-1h |
| Proposal lifetime cap | 24 h (team vote) |
| Strikes before removal | 2 |

Every score is logged so the threshold can be tuned on real data.

## Open

- How long-running events (e.g. a month-long exhibition) are split into sessions.
- Requirement wording to update: FR-017, FR-018, PERF-003, FUNC-002; OQ-004 is resolved by rule 4; OQ-003 partly by rule 6 (expired pairs stay excluded for the event).

## AI Usage Note

Drafted with Claude from an architecture discussion led by Viktoriia Baran.
