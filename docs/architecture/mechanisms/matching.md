# Matching Flow

## Decision

Users apply to an **event session**. Matching runs in **scheduled rounds** anchored to the session's start time, with an **instant match** for exceptionally good pairs and an **open mode** for latecomers after the last round.

## Rules

1. **Instant match on apply** — only if the top candidate scores at least the threshold **and** the two are each other's best option in the current pool. Otherwise the user waits for the next round.
2. **Scheduled rounds** — the whole pool of a session is paired at once, at fixed offsets before the start. Offsets that fall in the past are skipped. A round has no minimum score: every user who can be paired gets a proposal, from the best pairs down; only the instant match needs the threshold.
3. **Open mode** — after the last round, newcomers and declined users are matched instantly against the leftovers, until the session's cutoff. The cutoff also closes the session to new applications.
4. **Proposal lifetime** — valid for **24 h or until the next round starts, whichever comes first** (after the last round: until the cutoff of the last day the two share). Nobody is left in a pending proposal while a round runs without them. A job expires the proposal at `valid_until`.
5. **Decline** — both users return to the pool; the decliner excludes the candidate (FR-020).
6. **Expiry (no response)** — an expired pair is never proposed to each other again for this event.
   - The user who responded returns to the pool for the next round.
   - A user who did not respond gets a **strike** on this application. First strike: paused, asked "continue matching on this event?" — back in the pool only after "yes". Second strike: removed from the pool.
   - If neither responded, both get a strike.
   - A removed user may apply again; the new application starts with no strikes, but pair exclusions remain.
7. **Exclusivity** — the instant path and the round job take the same per-event lock before reading the pool, so a candidate is never claimed twice (FUNC-002). Accepting, declining and withdrawing take it too, so no answer crosses a round. The lock is per event, not per session, because an application can wait on several days of one event.
8. **Algorithm** — a pure function `match(pool, exclusions, seed) → pairings`, with no I/O (FUNC-001, MAIN-001).
9. **Sessions** — a single-day event has one session at its start time. A multi-day event (e.g. a month-long exhibition) gets one session per day, created when the first user applies for that day, at the time of day of the event start, computed in Europe/Kyiv. An application lists the days the user can go, any one of which suits them; it waits in the pool of each. A match lists the days both users listed, and the two decide which one to go on; the application then leaves every day's pool. Rounds and proposals work the same for single-day and multi-day events ([data model](../data-model.md), EventSession, ApplicationSession). A long session, such as a museum day, has its cutoff shortly before it ends instead of before it starts, so it takes applications after it starts; they arrive after the last round and are matched in open mode. The last session ends with the event; an earlier day's session ends at the event's end time on its day, or at the end of that day when the end time comes earlier in the day.

10. **Event changes** — a cancelled event, one published again and one whose sessions start at other times reach matching as the `event.changed` job (HLD I3), enqueued by the catalog for an organization's edit or cancellation (FR-011) and by the import (ADR-006, decision 10) in the transaction of the change. The job says only which event changed: matching reads the event as it is now, under the event's lock (rule 7), so a repeated or late job changes nothing. Only sessions still ahead are touched; past ones stay as they are.
    - **Cancelled** — its sessions are cancelled. Every active application (in the pool, paired or paused) is cancelled, and its pending proposals with `cancel_reason` `event_cancelled`.
    - **A day the event no longer has** — the session is cancelled and the applications lose that day. One left without a day still ahead is cancelled as above, unless its mutual match is kept (below); its pending proposal's other side returns to the pool if it keeps a day. A pending proposal whose shared days are gone, with none still ahead, is cancelled with `cancel_reason` `event_cancelled` even when both keep a day, since it could only become a match with no day to go; both return to the pool.
    - **A day that now starts at another time** — the applications move to the session at the new time: a new one, with its own rounds (rule 2), or one that exists already, also a cancelled one, which is scheduled again and keeps the round jobs it had. The session at the old time is cancelled, so its round jobs do nothing. A pending proposal on a day the two share that moved is cancelled with `cancel_reason` `event_changed`, since its `valid_until` followed the old time (rule 4); both return to the pool. A day moved to another date is the loss of that day, not a move: the applicant picked the date.
    - **A mutual match** — the two picked one of the days they share (rule 9). The match is cancelled with `cancel_reason` `event_cancelled` when the change takes away a shared day and leaves none still ahead: the event is cancelled, or its shared days are gone. Its applications that are still paired return to the pool, and its contacts are no longer shown. A match whose shared day moved to another time is kept on the session at the new time, and one whose shared days are all past is left as it is. A kept match keeps its applications `paired`, also one left without a day ahead, as a withdrawal does; they lose only the days that are gone.
    - **Published again** — the cancelled sessions it still has are scheduled again, keeping their round jobs. Cancelled applications and matches stay cancelled; users apply again, which a cancelled application allows.
    - **What does not change** — a run whose first day moves forward and an exhibition whose passed opening becomes its run keep the starts of their later days, so no job is enqueued for them (`sessionScheduleChanged`).
    - Every applicant whose days changed gets one `event_changed` notification, in the inbox and by push ([notifications](notifications.md)); with a mutual match, it says whether the match was cancelled or stands, so both of the two are told. Its dedupe key names the job and the application: a retried job tells no one twice, and every later change, also one back to an earlier time, comes with a job of its own and is told. A republished event tells no one.

## Policy (tunable, not architecture)

| Parameter | Draft value |
|---|---|
| Round offsets | T-7d, T-3d, T-24h, T-6h |
| Pair score | 0.7 × interests + 0.2 × the same kind of company + 0.1 × after-event plans, 0–1. Interests: shared interests count 1 and a heading both have without a shared interest under it counts 0.5, over all distinct interests of the two. Plans: shared plans over all distinct plans; neither wanting any counts as 1. Dating is paired only with dating, and only users with a day in common are paired |
| Instant-match threshold | 0.8 pair score |
| Open-mode cutoff | T-1h; for a long session, 2 h before it ends |
| Proposal lifetime cap | 24 h (team vote) |
| Strikes before removal | 2 |
| A long session | 3 h or more |

The score of every proposal, and of the best candidate at every instant-match attempt, is logged so the threshold can be tuned on real data.

## AI Usage Note

Drafted with Claude from an architecture discussion led by Viktoriia Baran.
