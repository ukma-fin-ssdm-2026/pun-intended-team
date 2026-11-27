# Notifications

## Decision

**Inbox first, push second.** Every notification is a row in the user's in-app inbox; push is a best-effort delivery of that row on mobile. The web build has no push, so the inbox is the only channel that reaches every platform (FLEX-001, COMP-001).

## Rules

1. A notification is written in the **same transaction** as the change that caused it — it cannot be lost.
2. Push delivery is retried; each inbox row is pushed **at most once**.
3. Every sender checks current state before sending (e.g. no reminder for a withdrawn user or a cancelled event).
4. Notifications is its own module: reached only through its interface, owns its own tables, reads no other module's tables.

## Interface

A module notifies through `NotificationsService` ([`notifications.service.ts`](../../../src/core/notifications/services/notifications.service.ts)), never through the table:

```ts
await this.transactions.run(async (tx) => {
  // ...the change that causes the notification...
  await this.notifications.notify(reporterId, 'report_received', {}, `report_received:${report.id}`, tx);
});
```

- **`tx` is required** (rule 1): the row and its `notifications.deliver` job commit or roll back with the change, as any job does ([job queue](job-queue.md), rule 1).
- **`dedupeKey`** is chosen by the sender, one per notification it means to send, such as `<type>:<id of what it is about>`. A sender that runs again, for example a retried job, passes the same key: nothing more is stored or enqueued, and `notify` returns `undefined`. The insert uses `ON CONFLICT DO NOTHING`, so a repeat does not abort the caller's transaction.
- **`payload`** is plain JSON with the details the app needs for the type; never contact details (data model). A type with no details has `{}`.
- **`notifyMany(notifications, tx)`** is `notify` for many at once, for a change that tells many users, as `event.changed` tells every applicant of an event: one insert and one `enqueueMany` of their deliveries, instead of two statements per user, so the transaction stays short ([database access](database-access.md#transactions)).
- **`notifications.deliver`** takes `{ notificationId }`. It reads the row first and does nothing when it is gone or no longer `pending`, so a repeated job changes nothing. Otherwise it pushes the row, see below.

The user reads the inbox with `GET /me/notifications` and marks a row read with `POST /notifications/{id}/read` ([API design](../../api/api-design.md#notifications)).

## Push Delivery

- **Devices.** The app registers its Expo push token with `PUT /me/push-token` once per sign-in and when it starts with a stored session ([`push-token.ts`](../../../app/src/api/push-token.ts)), not on the web; it is stored in `device_tokens` for the session of the request, one per session. A token registered again, by another account or session, moves to the new one. The token goes when its session ends: `SessionsService` removes it in the transaction that revokes the session (sign-out, `endAll` on a ban, a refresh with a stolen or replayed token). Identity already depends on notifications (HLD §2.2), so this adds no dependency the other way.
- **Sending.** `notifications.deliver` sends the row to every device of the account through `PushProvider.send`, at most 100 messages per request (HLD I5); `ExpoPushProvider` posts them to Expo Push without an access token. The text is one Ukrainian line by type ([`push-content.ts`](../../../src/core/notifications/services/push-content.ts)); a type whose sender is not built yet gets a general line. `data` carries only `notificationId` and `type`.
- **Outcome.** Expo answers with one ticket per message. One accepted ticket makes the row `sent`; all refused make it `failed`; an account without a device gets `skipped`. A refused message is not tried again. A token refused with `DeviceNotRegistered` is removed.
- **Retries and duplicates.** When the request fails as a whole (no answer, HTTP error, an answer of another shape), the handler throws and the job is retried with the row still `pending` ([job queue](job-queue.md), rule 2). **A retry can push the same row twice**: Expo may have taken the messages before the answer was lost, a second batch of 100 may fail after the first went out, or the process may stop between the send and the status update. Rule 2 (at most once) holds only once the status is written; the duplicate is accepted, since the alternative is losing pushes. After the last retry the row stays `pending`. Jobs are taken 20 at a time ([job queue](job-queue.md), rule 2): a failed job fails its batch, and the others run again but find their rows no longer `pending`.

## Not Done

Push receipts (Expo's delivery check about 15 minutes later), so a token whose receipt says `DeviceNotRegistered` stays until a later send; in the app, reading the inbox again while its screen stays open (it is read when the screen opens), opening the notification a push was tapped for, and showing a push while the app is in front, which Android then hides; push on iOS; a cleanup of expired sessions, so the device of a session that expired, rather than ended, still gets pushes.

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
| Report received | Report filed on a user or a listing (SAFE-003); also on a user already banned, so the reporter cannot tell the ban from it | Inbox + push |
| Someone wants to go with you (`listing_request`) | A user asks to join the recipient's listing; to the author, naming the requester | Inbox + push |
| Request accepted (`listing_request_accepted`) | The author accepts the request; to the requester, naming the author. A decline sends nothing, so the requester is never told they were turned down | Inbox + push |
| Verification code | Registration, password reset (FR-005) | Telegram Gateway API → SMS fallback, paused for now ([authentication](authentication.md), rule 6); not an inbox row (stored as VerificationCode) |

## AI Usage Note

Drafted with Claude from an architecture discussion led by Viktoriia Baran.
