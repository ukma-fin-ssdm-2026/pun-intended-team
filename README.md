# Nearby

[![CI](https://github.com/ukma-fin-ssdm-2026/pun-intended-team/actions/workflows/ci.yml/badge.svg)](https://github.com/ukma-fin-ssdm-2026/pun-intended-team/actions/workflows/ci.yml)

Team project for the SSDM course at the National University of Kyiv-Mohyla Academy, 2026

## ꩜ Project description

Nearby is a particularly whimsical mobile app for going to events and meeting new people along the way.

The app collects all the upcoming events in a city: films, exhibitions, concerts, protests or workshops — anything one may need company for. A user fills in a profile (interests, age, what they are looking for: friends, dating, or just company for the evening), picks an event they would like to attend, and gets matched with someone who wants to go to the same event and shares the most interests. Users can also propose their own events if one isn't already listed.

Instead of matching first and looking for something to do second, the event is what brings people together.

Look [here](Project-Description.md) for a more detailed project description

## ໑ Team

| Member | Role | GitHub |
|---|---|---|
| Viktoriya Baran | Repo Maintainer, Quality Lead, Architecture Lead, Backend Lead, API Design Lead, Documentation Lead | [@viktoriyabaran](https://github.com/viktoriyabaran) |
| Daryna Halytska | Documentation Lead, Project Brief Lead, Data & Threat Modeler, Documentation Lead (API), Security Analyst | [@DarynaHalytska](https://github.com/DarynaHalytska) |
| Oleh Moshenskyi | Issue Tracker Lead, Requirements Lead, FR Lead, Requirements-Architecture Mapper, Quality Lead (API), Code Reviewer, Prototype Lead | [@OLEGkn-coder](https://github.com/OLEGkn-coder) |
| Vladyslav Redchuk | CI Maintainer, Traceability Lead, UML Lead, Integration Lead, Quality Lead (code) | [@Vlad-Re](https://github.com/Vlad-Re) |

More on the team and our principles can be found [here](TeamCharter.md).

## ୭ Requirements Artifacts

Documentation related to requirements engineering for this project is located [here](docs/requirements/):

- [`requirements.md`](docs/requirements/requirements.md) — functional and non-functional requirements
- [`user-stories.md`](docs/requirements/user-stories.md) — user stories with acceptance criteria
- [`rtm.md`](docs/requirements/rtm.md) — Requirements Traceability Matrix
- [`use-cases.md`](docs/requirements/use-cases.md) — use case descriptions

## ໒ Architecture Artifacts

Documentation related to system architecture for this project is located [here](docs/architecture/):

- [`high-level-design.md`](docs/architecture/high-level-design.md) — architecture style, components and their interactions
- [`traceability-matrix.md`](docs/architecture/traceability-matrix.md) — requirements-to-components mapping
- [`data-model.md`](docs/architecture/data-model.md) — ER / domain model
- [`threat-model.md`](docs/architecture/threat-model.md) — STRIDE threat model
- [`decisions/`](docs/architecture/decisions/) — Architecture Decision Records (ADRs)
- [`mechanisms/`](docs/architecture/mechanisms/) — architectural and code mechanisms
- [`uml/`](docs/architecture/uml/) — UML diagrams (component, main server components, sequence, deployment, data model) with rendered SVGs in `rendered/`

## ൭ API Documentation

The REST API (NestJS) is Code-First: the OpenAPI spec is generated from the zod schemas in [`src/api/`](src/api/).

- [Swagger UI on GitHub Pages](https://ukma-fin-ssdm-2026.github.io/pun-intended-team/) — read-only docs, published from `main` on every push; the page itself is [`docs/api/index.html`](docs/api/index.html), with Swagger UI vendored in [`docs/api/vendor/swagger-ui/`](docs/api/vendor/swagger-ui/)
- [`openapi-generated.yaml`](docs/api/openapi-generated.yaml) — the generated spec the page shows; regenerate and commit it with `npm run docs:generate` after changing the API
- The `CI` workflow regenerates the spec and fails a pull request whose committed spec is out of date
- Local Swagger UI with "Try it out": run `npm run dev` and open http://localhost:4100/api-docs. Click **Authorize** and enter a stub token, listed under [Trying It Out](docs/api/api-design.md#trying-it-out)
- [`api-design.md`](docs/api/api-design.md) — resource model, endpoints, status codes, error format and versioning
- [`quality-attributes.md`](docs/api/quality-attributes.md) — quality goals for the Nearby REST API

## ⟡ Code Quality

- [`static-analysis.md`](docs/code-quality/static-analysis.md) — manual security review of the API code, security analyzer results and dependency audit
- [`review-report.md`](docs/code-quality/review-report.md) — code review of the Whadio team's project
- [`progress.md`](docs/code-quality/progress.md) — implementation progress of the prototype

## ര Running the API

Requires Node.js 26 or later.

```bash
npm install
npm run dev        # http://localhost:4100, Swagger UI at /api-docs; restarts on changes
```

For a production build: `npm run build`, then `npm start`.

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `4100` | Port the server listens on |
| `NODE_ENV` | — | `production` stops writing the spec on startup and hides Swagger UI |
| `SWAGGER_UI` | — | `true` serves Swagger UI in production too, e.g. on staging |
| `CORS_ORIGINS` | — | Comma-separated origins allowed to call the API from a browser, e.g. `http://localhost:8081` for the Expo web client; unset keeps CORS off |

Other scripts: `npm run typecheck` checks types without building, `npm run lint` and `npm run format` run ESLint and Prettier, `npm run test:e2e` runs the end-to-end tests in [`test/e2e/`](test/e2e/), and `npm run docs:generate` regenerates [`openapi-generated.yaml`](docs/api/openapi-generated.yaml).

Before the first commit, enable the commit message hook: `git config core.hooksPath .githooks`. The coding standard and review rules are in [§5 of the charter](TeamCharter.md#5-quality-and-code-review-policy).

## Commit hooks

Every commit runs [pre-commit](https://pre-commit.com/) with the hooks from [`.pre-commit-config.yaml`](.pre-commit-config.yaml): [gitleaks](https://github.com/gitleaks/gitleaks) looks for secrets in the staged changes, Prettier formats `.ts` and `.mjs` files and ESLint checks them. If a hook changes a file, the commit stops: review the change, `git add` it and commit again.

Install pre-commit once per machine, with [pipx](https://pipx.pypa.io/stable/installation/) (`sudo apt install pipx` on Ubuntu, `brew install pipx` on macOS):

```bash
pipx install pre-commit
```

The hooks run through `.githooks/pre-commit`, which is enabled by the same `git config core.hooksPath .githooks` as above. Without pre-commit the commit is refused and the hook prints this command. The first run downloads gitleaks and takes longer. To check the whole repository: `pre-commit run --all-files`.

If a commit from VS Code fails with "pre-commit is not installed", restart VS Code after `pipx ensurepath`, so it picks up the new `PATH`.

## ൬ Running the client

The Expo client in [`app/`](app/) lists the catalog events and opens their details, in a browser or on a phone. To run it next to the API, see [`app/README.md`](app/README.md).

## ൠ MCP Server

[`src/mcp/`](src/mcp/) is an [MCP](https://modelcontextprotocol.io/) server, generated from the OpenAPI spec, that exposes every API endpoint as a tool for AI agents such as Claude Code. [`.mcp.json`](.mcp.json) connects it to Claude Code as `nearby-api`. How to regenerate, run and connect it is described in [`AGENTS.md`](AGENTS.md#mcp-server).

## ༄ AI Usage Note

This README was written with the participation of Claude, which drafted the initial structure and wording. The draft was reviewed and edited by Daryna Halytska and Viktoriya Baran before being committed.
