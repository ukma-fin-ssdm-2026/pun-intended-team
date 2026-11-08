# Changelog

All notable changes to Nearby, the API and the app, are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Event import from ArtWizard and Karabas: Kyiv events of the 28-day catalog window are read from ArtWizard's events API, with ArtWizard's permission for the study project, and from the schema.org data of the Karabas pages, within its robots.txt; requests go at least 1 s apart, and venues without coordinates are found with Nominatim ([#364](https://github.com/ukma-fin-ssdm-2026/pun-intended-team/issues/364), [ADR-006](docs/architecture/decisions/ADR-006.md)). ArtWizard events and exhibitions without a start time in the window are skipped.
- `ARTWIZARD_API_KEY`, the import's key for the ArtWizard API, in `.env.example` and the staging settings.
- Categories Talks, Workshops, Cinema, Theatre, Stand-up, Sports, Festivals and Parties; Toloka is renamed Volunteering.
- `imageUrl` and `sourceUrl` on events in the API: the provider's image and event page for imported events, null for organization events.
- `slug` on categories ([#395](https://github.com/ukma-fin-ssdm-2026/pun-intended-team/issues/395)): made by the server from the name in Latin when a category is added and never changed, shown to administrators. The import maps providers' genres to slugs, so renaming a category no longer breaks it, and a skipped record names the slug: `Unknown category "concerts"`.
- Reporting a listing ([#382](https://github.com/ukma-fin-ssdm-2026/pun-intended-team/issues/382)): `POST /reports` takes `listingId` instead of `username`, and the report sheet on someone else's post reports the listing. Administrators see listing cases with the listing and its author, and `POST /admin/report-cases/{id}/remove-listing` removes the listing and resolves the case.
- Organization verification ([#383](https://github.com/ukma-fin-ssdm-2026/pun-intended-team/issues/383)): an account requests organization status with a name, a description and an official link (`PUT /me/organization`) and sees its status on the organization settings screen. Administrators verify or reject requests on the new Організації page of the admin panel (`/admin/organizations`); only a verified organization publishes events, and every decision is audited.

- Asking for a match at an event ([#374](https://github.com/ukma-fin-ssdm-2026/pun-intended-team/issues/374)): `POST /events/{id}/applications` puts the user in the pool of the event with their answers, the kind of company and the plans after the event, and for a multi-day event the days they can go, any one of which suits them; `GET /me/applications` lists the active applications and `POST /applications/{id}/withdraw` leaves the pool. Each day of an event is a session, created by the first application to it. A day takes applications until its matching cutoff, an hour before it starts or, for a session of 3 hours or more, 2 hours before it ends, and the answer says when the next round runs; matching itself comes with [#375](https://github.com/ukma-fin-ssdm-2026/pun-intended-team/issues/375) and [#409](https://github.com/ukma-fin-ssdm-2026/pun-intended-team/issues/409). In the app, the event page sends the request, asks which days of a multi-day event suit the user and sends a user with an incomplete profile to complete it; the search screen and the Метчі tab show the user's applications.

### Changed

- The event page shows only the start of an event whose end the provider did not give, instead of an end at 23:59.
- An application belongs to an event and keeps its days in `application_sessions`, and its plans after the event in `application_after_event_plans` instead of the `open_to_extend` column.
- The `reportUser` operation, and the MCP tool of the same name, is now `createReport`, since it reports listings too.
- The import's requests to the event providers and Nominatim wait a random time before each retry, at most 8 s, and log a request that failed after its last attempt.
- `/health` checks the database. A deploy whose API cannot reach the database is now rolled back.
- Category names are in Ukrainian, and unique regardless of case, spaces and apostrophe; a name is saved with single spaces and ʼ as its apostrophe ([#395](https://github.com/ukma-fin-ssdm-2026/pun-intended-team/issues/395)).

### Removed

- The Concert.ua adapter and its sample feed: Concert.ua sells the same concerts as Karabas, so importing both would split applicants between copies of one event.

### Fixed

- The API refuses to start with a database time limit above one day ([#385](https://github.com/ukma-fin-ssdm-2026/pun-intended-team/issues/385)). Such a value used to pass the check and break every database call.

### Refactoring

- The error filter answers a Nest 403 as 404 from its status table instead of a separate check, after characterization tests fixed its behaviour ([#348](https://github.com/ukma-fin-ssdm-2026/pun-intended-team/issues/348)). Technique: Substitute Algorithm (nearest catalog entry).

## [1.1.1] - 2026-11-01

### Refactoring

- Durations use shared time constants instead of hand-written arithmetic ([#306](https://github.com/ukma-fin-ssdm-2026/pun-intended-team/issues/306)). Technique: Replace Magic Number with Symbolic Constant.

## [1.1.0] - 2026-11-01

### Added

- Reporting a user by username, with a reason and an optional comment; repeated reports on one user are grouped into one case ([#323](https://github.com/ukma-fin-ssdm-2026/pun-intended-team/issues/323)).
- Admin endpoints to review report cases and ban the reported user, which ends all their sessions, or dismiss the case; each action is recorded in the audit log.
- Platform statistics for administrators: active users, upcoming events, matches and open report cases.
- Admin pages in the web app at `/admin`: statistics, report cases with Ban and Dismiss, and category management. They open on a computer; administrators find a link on the profile tab.
- The report sheet in the app sends reports to the API.
- The app's own Two Tickets icon replaces the default Expo icon, on phones, on the splash screen and as the favicon of the web app ([#338](https://github.com/ukma-fin-ssdm-2026/pun-intended-team/issues/338)).

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
- Web app built from [`app/`](app/): sign-up, sign-in and sign-out with Google through the API. The catalog, map, matches, announcements and profile screens show sample data for now.
- MCP server in [`src/mcp/`](src/mcp/) that exposes the API endpoints, except sign-in, as tools for AI agents.
- Staging deployment: every green merge to `main` publishes the API and web images and deploys them ([docs/operations/staging.md](docs/operations/staging.md)).

### Refactoring

- Event lookup for editing and cancelling reuses the plain lookup instead of repeating it ([#294](https://github.com/ukma-fin-ssdm-2026/pun-intended-team/issues/294)). Technique: Replace Inline Code with Function Call.
- Only the auth service raises Google linking errors; the data layer reports what happened instead of repeating them ([#302](https://github.com/ukma-fin-ssdm-2026/pun-intended-team/issues/302)). Technique: Extract Function and Change Function Declaration.
- Registration and profiles share one age calculation ([#304](https://github.com/ukma-fin-ssdm-2026/pun-intended-team/issues/304)). Technique: Move Function.

[Unreleased]: https://github.com/ukma-fin-ssdm-2026/pun-intended-team/compare/v1.1.1...HEAD
[1.1.1]: https://github.com/ukma-fin-ssdm-2026/pun-intended-team/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/ukma-fin-ssdm-2026/pun-intended-team/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/ukma-fin-ssdm-2026/pun-intended-team/releases/tag/v1.0.0

## AI Usage Note

Drafted with Claude Code from the OpenAPI spec and the merged pull requests, and reviewed by Viktoriia Baran.
