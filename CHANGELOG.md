# Changelog

All notable changes to Nearby, the API and the app, are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
- Only the auth service raises Google linking errors; the data layer reports what happened instead of repeating them ([#302](https://github.com/ukma-fin-ssdm-2026/pun-intended-team/issues/302)). Technique: Move Statements to Callers.
- Registration and profiles share one age calculation ([#304](https://github.com/ukma-fin-ssdm-2026/pun-intended-team/issues/304)). Technique: Move Function.

[Unreleased]: https://github.com/ukma-fin-ssdm-2026/pun-intended-team/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/ukma-fin-ssdm-2026/pun-intended-team/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/ukma-fin-ssdm-2026/pun-intended-team/releases/tag/v1.0.0

## AI Usage Note

Drafted with Claude Code from the OpenAPI spec and the merged pull requests, and reviewed by Viktoriia Baran.
