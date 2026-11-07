# Changelog

All notable changes to Nearby, the API and the app, are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Event import from ArtWizard and Karabas: Kyiv events of the 28-day catalog window are read from ArtWizard's events API, with ArtWizard's permission for the study project, and from the schema.org data of the Karabas pages, within its robots.txt; requests go at least 1 s apart, and venues without coordinates are found with Nominatim ([#364](https://github.com/ukma-fin-ssdm-2026/pun-intended-team/issues/364), [ADR-006](docs/architecture/decisions/ADR-006.md)). ArtWizard events and exhibitions without a start time in the window are skipped.
- `ARTWIZARD_API_KEY`, the import's key for the ArtWizard API, in `.env.example` and the staging settings.
- Categories Talks, Workshops, Cinema, Theatre, Stand-up, Sports, Festivals and Parties; Toloka is renamed Volunteering.
- `imageUrl` and `sourceUrl` on events in the API: the provider's image and event page for imported events, null for organization events.

### Added

- Imported events that a provider no longer lists are cancelled after a run that read its full list, and published again when they come back; a failed or partial run, or a list that looks broken, cancels nothing ([#366](https://github.com/ukma-fin-ssdm-2026/pun-intended-team/issues/366), ADR-006 decision 10). `import_runs` records whether a run's list was complete, how many records it saw and how many events each Karabas section listed (migration `import_run_lists`).

### Fixed

- Karabas `/clubs/` events that are not parties are no longer imported as Parties: only its `MusicEvent` records are, and the plain `Event` ones (talks, board-game nights, wine tastings) are skipped with the reason ([#366](https://github.com/ukma-fin-ssdm-2026/pun-intended-team/issues/366)).
- Karabas events are imported for the whole 28-day catalog window instead of the first page of each section, about 4 days: the import follows each section's "load more" link with `per-page=20`, at most 40 pages a section, so `/theatres/` with about 20 shows a day is read to the end too ([#366](https://github.com/ukma-fin-ssdm-2026/pun-intended-team/issues/366)).
- Requests to a provider site are never less than the interval apart: the wait is checked again when the timer fires early, which a live run showed at 0.999 s.
- The ArtWizard import asks for the coming 4 weeks only, the scope of ArtWizard's permission, one day less than the catalog window.
- A failed import run is reported with the error that stopped it, even when recording the failure fails too; a run that never finished is marked failed when its provider runs next, so it never counts as succeeded ([#366](https://github.com/ukma-fin-ssdm-2026/pun-intended-team/issues/366)).

### Removed

- The Concert.ua adapter and its sample feed: Concert.ua sells the same concerts as Karabas, so importing both would split applicants between copies of one event.

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
