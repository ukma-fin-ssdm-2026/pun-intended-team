# Changelog

All notable changes to Nearby, the API and the app, are recorded here.

## [Unreleased]

### Added

- Real events: the catalog shows Kyiv events of the next four weeks, imported from ArtWizard and Karabas.
- Reporting a listing: `POST /reports` takes either `username`, to report a user, or `listingId`, to report a listing, and the report sheet on someone else's listing reports it. Administrators see listing cases with the listing and its author, and `POST /admin/report-cases/{id}/remove-listing` removes the listing and resolves the case.
- Organization verification: an account requests organization status with a name, a description and an official link (`PUT /me/organization`) and sees its status on the organization settings screen. Administrators verify or reject requests on the new Organizations page of the admin panel (`/admin/organizations`).
- Time limits on the API's database calls: when the database does not answer in time, the request ends with 503 instead of never returning.
- A Backups page in the admin panel lists the nightly backups of the last 30 days with their status, and the admin overview warns when a backup needs attention.
- Asking for a match at an event: the user chooses the kind of company and the plans after the event, and for a multi-day event the days that suit them (`POST /events/{id}/applications`). A user with an incomplete profile is asked to complete it first. Applications for a day close an hour before it starts, or 2 hours before it ends if it lasts 3 hours or more. The Метчі tab lists the user's applications, and an application can be withdrawn. Matching itself comes later.
- A real map on the map tab: one pin per Kyiv venue with upcoming events and their number. A pin opens the venue's events, and the filters and the search narrow the pins. The map starts at the user's location when it is allowed, otherwise it shows the whole city. Android needs `GOOGLE_MAPS_ANDROID_API_KEY` in the EAS environment.

### Changed

- Events, venues, organizations and listings are kept in the database, so they are no longer lost when the API restarts, and the app shows them instead of sample data: the catalog with its filters, the event page, the listings, and publishing, editing and cancelling an organization's events.
- The `reportUser` operation, and the MCP tool of the same name, is now `createReport`, since it reports listings too.
- `/health` checks the database. A deploy whose API cannot reach the database is now rolled back.
- Categories are named in Ukrainian. Administrators can no longer add a category whose name differs from an existing one only in capital letters, spaces or the apostrophe, such as «Стендап» and «стендап».

### Fixed

- A failed nightly backup is tried again the same night, and a copy is kept only if it can be read back. A failed backup used to skip the day without notice.
- Profile edit shows «Повторити» when the interests fail to load, instead of hiding «+ ще».
- A short connection drop while the app renews the session no longer signs the user out.
- A rollback after a failed deploy names the migrations the previous version does not know, instead of only reporting "rolled back".

### Refactoring

- The error filter answers a NestJS 403 as 404 from its status table instead of a separate check, after characterization tests recorded its behaviour. Technique: Substitute Algorithm, the closest entry in Fowler's catalog.

## [1.1.1] - 2026-11-01

### Refactoring

- Durations use shared time constants instead of hand-written arithmetic. Technique: Replace Magic Number with Symbolic Constant.

## [1.1.0] - 2026-11-01

### Added

- Reporting a user by username, with a reason and an optional comment; repeated reports on one user are grouped into one case.
- Admin endpoints to review report cases and ban the reported user, which ends all their sessions, or dismiss the case; each action is recorded in the audit log.
- Platform statistics for administrators: active users, upcoming events, matches and open report cases.
- Admin pages in the web app at `/admin`: statistics, report cases with Ban and Dismiss, and category management. They open on a computer; administrators find a link on the profile tab.
- The report sheet in the app sends reports to the API.
- The app's own Two Tickets icon replaces the default Expo icon, on phones, on the splash screen and as the favicon of the web app.

## [1.0.0] - 2026-11-01

The first release, deployed to staging: the API at <https://api.nearbystaging.app> and the web app at <https://nearbystaging.app>.

### Added

- API, described in the [OpenAPI spec](docs/api/openapi-generated.yaml):
  - Sign-up and sign-in with Google, finishing registration with an age check, guest tokens for browsing, token renewal and sign-out.
  - Profiles: create, read and edit your profile, and set your interests.
  - Event catalog: browse, view, publish, edit and cancel events; categories and interests to pick from.
  - Listings: browse, view, post and remove listings, optionally about a catalog event.
  - Admin category management: add, rename, deactivate, reactivate and delete categories.
  - Health check at `/health`.
- Web app built from [`app/`](app/): sign-up, sign-in and sign-out with Google through the API. The catalog, map, matches, listings and profile screens show sample data for now.
- MCP server in [`src/mcp/`](src/mcp/) that exposes the API endpoints, except sign-in, as tools for AI agents.
- Staging deployment: every green merge to `main` publishes the API and web images and deploys them ([docs/operations/staging.md](docs/operations/staging.md)).

### Refactoring

- Event lookup for editing and cancelling reuses the plain lookup instead of repeating it. Technique: Replace Inline Code with Function Call.
- Only the auth service raises Google linking errors; the data layer reports what happened instead of repeating them. Technique: Extract Function and Change Function Declaration.
- Registration and profiles share one age calculation. Technique: Move Function.

[Unreleased]: https://github.com/ukma-fin-ssdm-2026/pun-intended-team/compare/v1.1.1...HEAD
[1.1.1]: https://github.com/ukma-fin-ssdm-2026/pun-intended-team/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/ukma-fin-ssdm-2026/pun-intended-team/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/ukma-fin-ssdm-2026/pun-intended-team/releases/tag/v1.0.0

## AI Usage Note

Drafted with Claude Code from the OpenAPI spec and the merged pull requests, and reviewed by Viktoriia Baran.
