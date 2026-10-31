# Changelog

All notable changes to the Nearby API are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-10-31

The first release of the API, deployed to staging. The API is described in the [OpenAPI spec](docs/api/openapi-generated.yaml).

### Added

- Sign-up and sign-in with Google, finishing registration with an age check, guest tokens for browsing, token renewal and sign-out.
- Profiles: create, read and edit your profile, and set your interests.
- Event catalog: browse, view, publish, edit and cancel events; categories and interests to pick from.
- Listings: browse, view, post and remove listings, optionally about a catalog event.
- Admin category management: add, rename, deactivate, reactivate and delete categories.
- Health check at `/health`.
- MCP server in `src/mcp/` that exposes the API endpoints, except sign-in, as tools for AI agents.

### Refactoring

- Event lookup for editing and cancelling reuses the plain lookup instead of repeating it (#294). Technique: Replace Inline Code with Function Call.
- Google linking errors are raised only in the auth service, not repeated in the data layer (#302). Technique: Extract Function.
- Registration and profiles share one age calculation (#304). Technique: Move Function.
- Durations use shared time constants instead of hand-written arithmetic (#306). Technique: Replace Magic Number with Symbolic Constant.

[Unreleased]: https://github.com/ukma-fin-ssdm-2026/pun-intended-team/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/ukma-fin-ssdm-2026/pun-intended-team/releases/tag/v1.0.0

## AI Usage Note

Drafted with Claude Code from the OpenAPI spec and the merged pull requests, and reviewed by Viktoriia Baran.
