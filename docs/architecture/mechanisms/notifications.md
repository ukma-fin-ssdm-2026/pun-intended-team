# Notifications

## Decision

**Inbox first, push second.** Every notification is a row in the user's in-app inbox; push is a best-effort delivery of that row on mobile. The web build has no push, so the inbox is the only channel that reaches every platform (FLEX-001, COMP-001).

## Rules

1. A notification is written in the **same transaction** as the change that caused it — it cannot be lost.
2. Push delivery is retried; each inbox row is pushed **at most once**.
3. Every sender checks current state before sending (e.g. no reminder for a withdrawn user or a cancelled event).
4. Notifications is its own module: reached only through its interface, owns its own tables, reads no other module's tables.

## Catalogue

| Notification | Trigger | Channel |
|---|---|---|
| Match proposed | Instant match or round | Inbox + push |
| Match is mutual, contacts revealed | Second acceptance | Inbox + push |
| Respond soon | 4 h before `valid_until` (halfway for short windows) | Inbox + push |
| Not a match this time | Decline, or expiry for the user who responded — "we'll find you someone better", never "you were declined" | Inbox |
| Continue matching? | First strike (no response) — with a "yes" action | Inbox + push |
| Removed from matching | Second strike — says the user can apply again | Inbox |
| No match found | Open-mode cutoff passes, user still unpaired (FR-018) | Inbox + push |
| Event reminder | 3 h before the event (FR-024) — after the last round (T-6h), before the cutoff (T-1h) | Inbox + push |
| Event changed / cancelled | Organization edit or import (FR-011) | Inbox + push |
| Report received | Report filed (SAFE-003) | Inbox |
| Verification code | Registration, password reset (FR-005) | Telegram Gateway API → SMS fallback; not an inbox row (stored as VerificationCode) |

## AI Usage Note

Drafted with Claude from an architecture discussion led by Viktoriia Baran.
