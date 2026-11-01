<!-- Written with the help of Claude -->
# API Design

## 1. Architecture Overview

| | |
|---|---|
| Base URL (local) | `http://localhost:4100` |
| Style | REST, resources as plural nouns |
| Transport | Clients reach the API only over HTTPS (TLS 1.2+); plain HTTP is redirected. TLS ends at the load balancer, which forwards plain HTTP to the server inside the private network ([high-level design](../architecture/high-level-design.md), threat model TB1/TB2). The server itself never handles TLS, so locally it is plain HTTP |
| Format | JSON in and out; times are ISO 8601 with an offset (`2026-10-17T19:00:00+03:00`), ids are UUIDs |
| Authentication | JWT bearer access token ([authentication](../architecture/mechanisms/authentication.md)). Access tokens are valid for 60 minutes; a signed-in account also gets a refresh token, valid for 30 days, that renews them. Catalog reads accept a guest token from `/auth/guest`, so even guests send a token ([catalog access](../architecture/mechanisms/catalog-access.md)) |
| Versioning | In the URL path: every business endpoint starts with `/api/v1`. Service endpoints such as `/health` have no version |
| Specification | Generated from the code into [`openapi-generated.yaml`](openapi-generated.yaml); Swagger UI at `/api-docs` outside production, or in production when `SWAGGER_UI=true` (e.g. on staging) |

**Versioning rule.** Adding an endpoint, an optional request field or a response field does not change the version. Removing or renaming a field, changing its type, or making an optional field required does, and goes to `/api/v2` while `/api/v1` keeps working for the clients that still use it.

## 2. Resource Model

The API exposes three main resources: **Events** (the catalog), **Listings** (users' "looking for company" posts) and the signed-in user's own **Profile**, plus two lookups: **Categories**, which events and listings refer to, and **Interests**, which profiles refer to. All of them come from the [data model](../architecture/data-model.md).

### Event

**Base path:** `/api/v1/events`

An event in the city that users can go to together. It is posted by a verified organization or brought in by the importer.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `title` | string | |
| `description` | string | |
| `category` | `{ id, name }` | |
| `venue` | `{ id, name, address, location: { lat, lng } }` | |
| `startsAt`, `endsAt` | date-time | |
| `source` | `organization` \| `import` | |
| `status` | `published` \| `cancelled` | A cancelled event stays readable, so users who picked it see why it is gone |

Related to: Category, Venue, Organization (none for imported events), Listing.

Not exposed: organizer contacts and the number of applicants or attendees (catalog access, rule 1).

### Listing

**Base path:** `/api/v1/listings`

A user's post such as "looking for company for an exhibition on Saturday".

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `author` | `{ username, displayName }` | Never the author's contacts |
| `category` | `{ id, name }` | |
| `eventId` | UUID or `null` | Set when the listing is about a catalog event |
| `title` | string | |
| `description` | string | |
| `date` | date | |
| `status` | `active` \| `removed` | Only `active` listings are returned to users |

Related to: Account (author), Category, Event.

### Profile

**Base paths:** `/api/v1/me/profile`, `/api/v1/me/profile/interests`, `/api/v1/me/profile/linked-accounts`

The signed-in user's own profile, built step by step during onboarding (FR-002, US-003) and edited afterwards. The resource is singular and lives under `/me`: a user only ever sees their own profile here, so there is no id to guess. Other users' profiles are shown only through listings (`author`).

| Field | Type | Notes |
|---|---|---|
| `username` | string | Required at creation. Unique regardless of case, 3 to 30 letters, digits, dots or underscores, starting with a letter or a digit |
| `displayName` | string | Required at creation, 1 to 50 characters |
| `description` | string | Free text up to 500 characters; empty until set |
| `occupation` | string | Studies or work, free text up to 100 characters; empty until set |
| `communicationFormat` | `friends` \| `dating` \| `company` \| `null` | `null` until the user picks one |
| `sharePhone` | boolean | Default `true`: whether the phone number is revealed on a mutual match; no account has one while sign-in is Google-only ([ADR-004](../architecture/decisions/ADR-004.md)) |
| `age` | integer | Whole years, computed on the server from the account's date of birth. The date itself is never returned (data model §4) |
| `interests` | `[{ id, name }]` | Empty until the user picks some |
| `linkedAccounts` | `[{ network, username, url }]` | Social networks a mutual match sees: `network` is `telegram`, `instagram`, `whatsapp`, `tiktok` or `facebook`, at most one each; `username` is the bare handle (for WhatsApp, the phone number digits), stored encrypted; `url` is the profile link. Empty until set during onboarding |
| `isComplete` | boolean | `true` once `communicationFormat` is set, at least one interest is picked **and** at least one network is linked; matching needs all three (use case E1) |

Related to: Account (`age` comes from its date of birth), Interest.

Not in this version: photo upload. A mutual match needs a contact to reveal, and while sign-in is Google-only there is no phone number, so the contact is a linked network: `PUT /me/profile/linked-accounts` refuses an empty list, and `sharePhone` plays no part in the check.

### Interest

**Base path:** `/api/v1/interests`

A lookup, like Category: a fixed list seeded at launch that users pick from. It has no admin endpoints.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `name` | string | Unique |

Related to: Profile (many to many).

### Category

**Base paths:** `/api/v1/categories` (read), `/api/v1/admin/categories` (management)

A lookup, not a resource users work with: it exists to filter the catalog and to classify events and listings. Only administrators manage it (FR-029), and changes show up in the catalog filters immediately.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `name` | string | Unique, case-insensitive |
| `isActive` | boolean | Admin responses only. An inactive category disappears from the filters and cannot be picked for new events or listings, but existing ones keep it |

Related to: Event, Listing.

## 3. Endpoints

Each endpoint lists every status it can return. `429` (rate limit) and `500` can come from any endpoint, so they are left out of the tables.

### Auth

| Method | Path | Who | Success | Errors |
|---|---|---|---|---|
| `POST` | `/api/v1/auth/google/register` | Anyone, no token | `200` a registration token | `400`, `409`, `422` |
| `POST` | `/api/v1/auth/complete-registration` | The registration token | `200` the tokens of the new account's first session | `400`, `401`, `404`, `409`, `422` |
| `POST` | `/api/v1/auth/google` | Anyone, no token | `200` the tokens of a new session | `400`, `401` |
| `POST` | `/api/v1/auth/refresh` | Anyone, no token | `200` a new access token and refresh token | `400`, `401`, `429` |
| `POST` | `/api/v1/auth/sign-out` | Signed-in user | `204` | `401` |
| `POST` | `/api/v1/auth/guest` | Anyone, no token | `200` a guest token | — |

Sign-up and sign-in are Google-only for now ([ADR-004](../architecture/decisions/ADR-004.md)); the phone and password endpoints are removed until codes can be paid for. Registration takes two calls: `google/register` checks the ID token from Google Sign-In and returns a registration token, valid for 15 minutes, that only `complete-registration` accepts; `complete-registration` takes the date of birth and activates the account. Under 18, the registration is removed and the Google account can start again. A Google account that is already registered gets `409 GOOGLE_ACCOUNT_TAKEN`; `POST /auth/google` signs it in. Accounts are never matched by email.

`google/register`, `google` and `refresh` take 20 requests a minute per IP each. Every token response is `{ accessToken, tokenType: "Bearer", expiresIn }`; the ones that sign in add `refreshToken`.

A sign-in starts a session (SEC-005). `refresh` renews it with the refresh token and replaces that token, so the app keeps the new one; a wrong refresh token for the session, such as a replaced one used again, ends the session. `sign-out` ends the current session. An ended session's access token gets `401` on the next request, before it expires.

### Events

| Method | Path | Who | Success | Errors |
|---|---|---|---|---|
| `GET` | `/api/v1/events` | Anyone with a guest or user token | `200` a page of events | `400`, `401` |
| `GET` | `/api/v1/events/{id}` | Anyone with a guest or user token | `200` the event | `400`, `401`, `404` |
| `POST` | `/api/v1/events` | Verified organization | `201` the event + `Location` header | `400`, `401`, `422` |
| `PUT` | `/api/v1/events/{id}` | The organization that posted it | `200` the updated event | `400`, `401`, `404`, `422` |
| `POST` | `/api/v1/events/{id}/cancel` | The organization that posted it | `200` the event, now `cancelled` | `400`, `401`, `404` |

`PUT /api/v1/events/{id}` **replaces** the editable fields (FR-010): its body is the same as `POST`'s (`title`, `description`, `categoryId`, `venueId`, `startsAt`, `endsAt`), and every field is required. An event is not a draft that grows step by step, so the client sends the whole edited form and does not have to guess which fields it forgot to send; `status` and `source` cannot be sent, so an edit cannot cancel an event (that is `POST /events/{id}/cancel`). Only the organization that posted the event may edit it: anyone else, including another verified organization, gets the same `404` as for a missing event. A cancelled event cannot be edited (`422 EVENT_CANCELLED`). Missing or invalid fields give a `400` with one `details` entry per field.

`GET /api/v1/events` query parameters (FR-007):

| Parameter | Type | Default | Out of range |
|---|---|---|---|
| `categoryId` | UUID | any category | — |
| `from` | date | today | Before today: clamped to today, the catalog shows only upcoming events (FR-006) |
| `to` | date | end of the catalog window (today + 28 days) | Past the window: clamped to its end. Before `from`: `400` |
| `venueId` | UUID | any venue; used when a map pin is tapped (FR-013) | — |
| `limit`, `offset` | integer | see [pagination](#pagination) | `limit` above 20: `400` |

Dates are clamped because a user scrolling the date picker too far should just see the events that exist. `limit` is rejected because only a script asks for more than a page, and it should learn the cap rather than be silently short-changed.

### Listings

| Method | Path | Who | Success | Errors |
|---|---|---|---|---|
| `GET` | `/api/v1/listings` | Signed-in user | `200` a page of listings | `400`, `401` |
| `GET` | `/api/v1/listings/{id}` | Signed-in user | `200` the listing | `400`, `401`, `404` |
| `POST` | `/api/v1/listings` | Signed-in user | `201` the listing + `Location` header | `400`, `401`, `422` |
| `DELETE` | `/api/v1/listings/{id}` | The author | `204` | `400`, `401`, `404` |

### Profile and Interests

| Method | Path | Who | Success | Errors |
|---|---|---|---|---|
| `GET` | `/api/v1/interests` | Signed-in user | `200` all interests (not paginated) | `401` |
| `GET` | `/api/v1/me/profile` | Signed-in user | `200` the profile | `401`, `404` |
| `POST` | `/api/v1/me/profile` | Signed-in user | `201` the profile + `Location: /api/v1/me/profile` | `400`, `401`, `409` |
| `PATCH` | `/api/v1/me/profile` | Signed-in user | `200` the updated profile | `400`, `401`, `404`, `409` |
| `PUT` | `/api/v1/me/profile/interests` | Signed-in user | `200` the updated profile | `400`, `401`, `404`, `422` |
| `PUT` | `/api/v1/me/profile/linked-accounts` | Signed-in user | `200` the updated profile | `400`, `401`, `404`, `422` |

Onboarding goes in steps (FR-002). The first step, `POST /me/profile`, takes only the required `username` and `displayName`. Every later step and the edit screen use `PATCH /me/profile`, which takes any of `displayName`, `username`, `description`, `occupation`, `communicationFormat` and `sharePhone`; only the fields sent change, and an empty body is a `400`. `PUT /me/profile/interests` takes `{ "interestIds": [...] }` and replaces the whole set, so the client sends what the user ticked rather than adding and removing one by one; a repeated id counts once, an empty list clears the set. Ids come from `GET /interests`; an unknown one is `422 REFERENCE_NOT_FOUND` and nothing changes. `PUT /me/profile/linked-accounts` takes `{ "linkedAccounts": [{ "network", "username" }] }` and replaces the whole set the same way; a `network` that appears twice is a `400`, an empty list is `422 CONTACT_REQUIRED`. `username` may be a nickname with or without `@` or a pasted profile link (`t.me/…`, `instagram.com/…`, `tiktok.com/@…`, `facebook.com/…`, `wa.me/…`); the server keeps the bare handle and answers a `400` on that `username` when it does not fit the network. The rules live in `core/profiles/services/social-networks.ts`.

A profile that does not exist yet is a `404` on `GET` and `PATCH`, and on the interests `PUT`: the client answers it by starting onboarding with `POST`. A second `POST` is `409 PROFILE_EXISTS`. A username another user already has, in any letter case, is `409 USERNAME_TAKEN`, on `POST` and on `PATCH`; a user may change the case of their own username.

### Categories

| Method | Path | Who | Success | Errors |
|---|---|---|---|---|
| `GET` | `/api/v1/categories` | Anyone with a guest or user token | `200` the active categories | `401` |
| `GET` | `/api/v1/admin/categories` | Administrator | `200` all categories, with `isActive` | `401`, `404` |
| `GET` | `/api/v1/admin/categories/{id}` | Administrator | `200` the category | `400`, `401`, `404` |
| `POST` | `/api/v1/admin/categories` | Administrator | `201` the category + `Location` header | `400`, `401`, `404`, `409` |
| `PATCH` | `/api/v1/admin/categories/{id}` | Administrator | `200` the updated category | `400`, `401`, `404`, `409` |
| `DELETE` | `/api/v1/admin/categories/{id}` | Administrator | `204` | `400`, `401`, `404`, `409` |

`POST` takes `{ name, isActive? }` (active by default); `PATCH` takes either field, so the same call renames, deactivates or reactivates. A duplicate name is a `409`. The category lists are not paginated.

### System

| Method | Path | Who | Success | Errors |
|---|---|---|---|---|
| `GET` | `/health` | Anyone, no token | `200` `{ "status": "ok" }` | — |

`400` on an endpoint with an `{id}` covers an id that is not a UUID. The `422` codes of each endpoint are listed under [business-rule codes](#business-rule-codes-422).

The listing feed shows active listings dated today or later. A listing cannot be posted for a past date; once its date has passed, it is kept and can still be read by id. Deleting a listing marks it `removed` rather than erasing the row, since a report case may point at it; from then on it is a `404` like any missing listing.

## 4. Design Decisions

### Why Code-First?

The endpoints are written in NestJS, and each one is declared with `@Endpoint`, which carries its path, its zod request schemas and every response. The same declaration drives both request validation and the OpenAPI document, so the spec cannot drift from what the server actually does. The types come from the schemas too, so a handler that returns the wrong shape does not compile. Writing the YAML by hand would mean keeping two copies in sync.

### Pagination

The event and listing feeds use offset pagination: `limit` (default 20, maximum 20; a larger value is a `400` error) and `offset` (default 0). The maximum is low on purpose, so the catalog cannot be copied in a few requests ([catalog access](../architecture/mechanisms/catalog-access.md), rule 2).

```json
{
  "items": [ ... ],
  "page": { "limit": 20, "offset": 40, "hasMore": true }
}
```

There is no `total`: the client only needs to know whether to load more, and a total would tell a scraper how big the catalog is.

### Actions as Sub-Resources

Cancelling an event is `POST /events/{id}/cancel`, not `DELETE`, because the event is not removed: it stays readable with `status: cancelled`, and the users who picked it are notified (FR-011). Cancelling an event that is already cancelled returns `200` again and notifies nobody, so a retried request is harmless.

### Administration Endpoints

Everything administrators manage lives under `/api/v1/admin/*` (HLD I1), apart from the read endpoints everyone uses. So `GET /categories` always means the same thing (the active categories), and the admin screen asks `GET /admin/categories` for all of them, instead of one endpoint whose answer depends on the caller's role or a `showInactive` flag. A caller who is not an administrator gets a `404` from any `/admin` endpoint, under the no-`403` rule below, so the admin API does not reveal that it exists.

### Deleting a Category

Events and listings refer to their category, so a category can only be deleted while nothing uses it; otherwise the answer is `409 CONFLICT` with the advice to deactivate it instead. The database enforces this (`ON DELETE RESTRICT`) and the repository turns the foreign-key error into `CONFLICT`. The catalog module could not check on its own: listings are another module's table, and asking the listings module would create a dependency cycle (HLD §2.2).

### Error Handling

#### Status codes

Every endpoint declares exactly one success status. The server refuses to start if an endpoint declares none or several.

##### Success

| Status | When | Body |
|---|---|---|
| `200 OK` | The request succeeded: a read, or an update that returns the updated object | The object |
| `201 Created` | A new object was created | The created object, plus a `Location` header with its URL |
| `204 No Content` | A delete succeeded, or an action with nothing to return | None (the server refuses to start if a 204 declares a body schema) |

##### Errors

Every error has the `ErrorResponse` body: `{ "error": { "code", "message", "details"? } }`. Clients branch on `code`, never on `message`.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request is invalid",
    "details": [{ "location": "params", "field": "id", "message": "Invalid UUID" }]
  }
}
```

| Status | `code` | When |
|---|---|---|
| `400 Bad Request` | `VALIDATION_ERROR` | Params, query or body do not match the schema, and `details` lists every invalid field. Also a body that is not valid JSON or a URL with broken encoding; those have no `details`, since no single field is at fault. A body with fields the endpoint does not accept gets one `details` entry with an empty `field`; the unknown names are not echoed back |
| `401 Unauthorized` | `UNAUTHENTICATED`, `INVALID_CREDENTIALS`, `INVALID_REFRESH_TOKEN` | `UNAUTHENTICATED`: no access token, an invalid or expired one, one of an ended session, or a registration token outside `complete-registration`. `INVALID_CREDENTIALS`: sign-in with an invalid Google ID token or a Google account that is not registered. `INVALID_REFRESH_TOKEN`: the session expired or was ended, or the refresh token was already replaced; the app signs in again |
| `404 Not Found` | `NOT_FOUND` | The resource does not exist, **or the caller may not access it**, or no route matches (including a wrong method on an existing path) |
| `409 Conflict` | `CONFLICT`, or one code per business rule (see below) | The request conflicts with the current state, e.g. a duplicate category name, or deleting a category that is in use |
| `413 Content Too Large` | `PAYLOAD_TOO_LARGE` | The body is larger than 100 kB |
| `422 Unprocessable Content` | one code per business rule | The body is valid, but a business rule forbids the action |
| `429 Too Many Requests` | `RATE_LIMITED` | A rate limit was hit (SEC-007), with `Retry-After` in seconds |
| `500 Internal Server Error` | `INTERNAL_ERROR` | Anything unexpected; details are logged, never returned |

**No `403`.** A caller who may not access a resource gets the same `404` as if it did not exist, so the API never reveals that it exists (SEC-001, e.g. a match that is not mutual yet).

##### Business-rule codes (`422`)

| `code` | Endpoint | When |
|---|---|---|
| `ORGANIZATION_NOT_VERIFIED` | `POST /events`, `PUT /events/{id}` | The caller is not an organization, or its verification is not `verified` |
| `REFERENCE_NOT_FOUND` | `POST /events`, `PUT /events/{id}`, `POST /listings`, `PUT /me/profile/interests` | A referenced category is missing or deactivated, a venue is not one of the organization's own, a referenced event does not exist, or an interest id is not in the list. The message names which |
| `EVENT_ENDS_BEFORE_START` | `POST /events`, `PUT /events/{id}` | `endsAt` is not after `startsAt` |
| `UNDERAGE` | `POST /auth/complete-registration` | The date of birth is less than 18 years ago, by the Kyiv date (SAFE-001); the registration is removed |
| `INVALID_GOOGLE_TOKEN` | `POST /auth/google/register` | The Google ID token is invalid, expired or issued to another app |
| `EVENT_CANCELLED` | `PUT /events/{id}`, `POST /listings` | The event is cancelled, so it can no longer be edited or have listings posted for it |
| `CONTACT_REQUIRED` | `PUT /me/profile/linked-accounts` | The list is empty; a profile keeps at least one network for a mutual match to see |
| `LISTING_DATE_IN_PAST` | `POST /listings` | `date` is before today, Kyiv time |

A reference that cannot be used is a `422`, not a `404`: the URL exists, it is a value in the body that is wrong.

##### Business-rule codes (`409`)

| `code` | Endpoint | When |
|---|---|---|
| `USERNAME_TAKEN` | `POST /me/profile`, `PATCH /me/profile` | Another profile already has this username; the comparison ignores letter case (unique index on `lower(username)`) |
| `PROFILE_EXISTS` | `POST /me/profile` | The account already has a profile; continue with `PATCH` |
| `GOOGLE_ACCOUNT_TAKEN` | `POST /auth/google/register` | The Google account is already registered; sign in with `POST /auth/google` |

### Trying It Out

The server needs its key files: run `npm run keys:generate` and copy the key lines from `.env.example` into `.env`. Set `GOOGLE_CLIENT_IDS` to the client id of the Google OAuth web client the app uses; until then Google sign-in refuses every token.

Get a token from an Auth endpoint, then in Swagger UI (`/api-docs`) click **Authorize** and paste the `accessToken`; with curl, send `Authorization: Bearer <token>`. Access tokens last 60 minutes; `POST /api/v1/auth/refresh` with the `refreshToken` gets a new one.

- **Guest** (catalog reads only): `POST /api/v1/auth/guest`.
- **Your account:** sign up or sign in with Google in the app's web build, then copy the `accessToken` from the response of `/auth/google` or `/auth/complete-registration` in the browser's network tab. There are no shared development accounts.
- **Administrator:** set your account's `role` to `admin` in the database ([local database](../../README.md#local-database)), then sign in again: the role is part of the access token.

Accounts and sessions are in the database. Profiles, organizations, events and listings are still stubs in `src/infra/stubs/data.ts`, kept in memory until the server restarts; they belong to account ids that only the e2e tests create.

## AI Usage Note

Drafted with Claude from the project's requirements, data model and architecture documents. Reviewed and edited by Viktoriia Baran.

**Profile and Interest resources, `PUT /events/{id}` (issues #141, #142).** The Profile and Interest sections, the Profile and Interests endpoint tables, the `409` codes table, the `PUT` paragraph under Events and the changed error tables were written with Claude. Verified by: `npm run test:e2e` (every rule above has a test), `npm run docs:generate`, and a comparison of the tables with `docs/api/openapi-generated.yaml`. To be reviewed by: Viktoriia Baran (API Design Lead).
