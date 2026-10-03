# Nearby

[![CI Test](https://github.com/ukma-fin-ssdm-2026/pun-intended-team/actions/workflows/ci.yml/badge.svg)](https://github.com/ukma-fin-ssdm-2026/pun-intended-team/actions/workflows/ci.yml)

Team project for the SSDM course at the National University of Kyiv-Mohyla Academy, 2026

## ꩜ Project description

Nearby is a particularly whimsical mobile app for going to events and meeting new people along the way.

The app collects all the upcoming events in a city: films, exhibitions, concerts, protests or workshops — anything one may need company for. A user fills in a profile (interests, age, what they are looking for: friends, dating, or just company for the evening), picks an event they would like to attend, and gets matched with someone who wants to go to the same event and shares the most interests. Users can also propose their own events if one isn't already listed.

Instead of matching first and looking for something to do second, the event is what brings people together.

Look [here](Project-Description.md) for a more detailed project description

## ໑ Team

| Member | Role | GitHub |
|---|---|---|
| Viktoriya Baran | Repo Maintainer, Quality Lead, Architecture Lead, Backend Lead, API Design Lead | [@viktoriyabaran](https://github.com/viktoriyabaran) |
| Daryna Halytska | Documentation Lead, Project Brief Lead, Data & Threat Modeler, Documentation Lead (API) | [@DarynaHalytska](https://github.com/DarynaHalytska) |
| Oleh Moshenskyi | Issue Tracker Lead, Requirements Lead, FR Lead, Requirements-Architecture Mapper, Quality Lead (API) | [@OLEGkn-coder](https://github.com/OLEGkn-coder) |
| Vladyslav Redchuk | CI Maintainer, Traceability Lead, UML Lead, Integration Lead | [@Vlad-Re](https://github.com/Vlad-Re) |

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
- [`uml/`](docs/architecture/uml/) — UML diagrams (component, main server components, sequence, deployment, data model) with rendered SVGs in `rendered/`

## ൭ API Documentation

The REST API (NestJS) is Code-First: the OpenAPI spec is generated from the zod schemas in [`src/api/`](src/api/).

- [Swagger UI on GitHub Pages](https://ukma-fin-ssdm-2026.github.io/pun-intended-team/) — read-only docs, published from `main` on every push; the page itself is [`docs/api/index.html`](docs/api/index.html), with Swagger UI vendored in [`docs/api/vendor/swagger-ui/`](docs/api/vendor/swagger-ui/)
- [`openapi-generated.yaml`](docs/api/openapi-generated.yaml) — the generated spec the page shows; regenerate and commit it with `npm run docs:generate` after changing the API
- The `API docs (GitHub Pages)` workflow regenerates the spec and fails a pull request whose committed spec is out of date
- Local Swagger UI with "Try it out": run `npm run dev` and open http://localhost:4100/api-docs. Click **Authorize** and enter a stub token, listed under [Trying It Out](docs/api/api-design.md#trying-it-out)
- [`api-design.md`](docs/api/api-design.md) — resource model, endpoints, status codes, error format and versioning

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

Other scripts: `npm run typecheck` checks types without building, `npm run test:e2e` runs the end-to-end tests in [`test/e2e/`](test/e2e/), and `npm run docs:generate` regenerates [`openapi-generated.yaml`](docs/api/openapi-generated.yaml).

## ൠ MCP Server

[`src/mcp/`](src/mcp/) is an [MCP](https://modelcontextprotocol.io/) server that exposes every API endpoint as a tool, so an AI agent such as Claude Code can call the API. It is generated from [`openapi-generated.yaml`](docs/api/openapi-generated.yaml) by [openapi-mcp-generator](https://github.com/harsha-iiiv/openapi-mcp-generator), pinned in [`tools/mcp-generator/`](tools/mcp-generator/). Tool names are the `operationId`s; descriptions and parameter docs come from the spec.

Do not edit `src/mcp/` by hand. If an agent misreads a tool, fix the `summary`, `description` or `.describe()` in [`src/api/`](src/api/), then regenerate the spec and the server:

```bash
npm run docs:generate   # spec from the zod schemas (see API Documentation)
npm run mcp:generate    # src/mcp/ from the committed spec
npm run mcp:build       # installs src/mcp/ dependencies and compiles to src/mcp/build/
```

`src/mcp/` is a separate Node project with its own `package.json` and lock file, and is excluded from the API's `tsconfig.json`. Each regeneration also changes the `Generated on` timestamp in `src/mcp/src/index.ts`.

### Running it

Start the API first (`npm run dev`, see [Running the API](#ര-running-the-api)). The MCP server talks over stdio and forwards each tool call to the API:

```bash
BEARER_TOKEN_BEARERAUTH=stub-guest node src/mcp/build/index.js
```

Start it with `node`, not `npm start`: npm prints its own lines to stdout, which breaks the stdio protocol, and rebuilds on every start.

| Variable | Default | Meaning |
|---|---|---|
| `BEARER_TOKEN_BEARERAUTH` | — | Sent as `Authorization: Bearer …` on every call. Use a stub token from [Trying It Out](docs/api/api-design.md#trying-it-out): `stub-guest` is enough for catalog reads; other tools answer 401 or 404 unless the token has the right role |
| `API_BASE_URL` | `http://localhost:4100` | API the tools call; the default comes from `servers` in the spec |

Pass tokens as environment variables, never in a committed file.

To list the tools and call one without an agent, use the [MCP Inspector](https://github.com/modelcontextprotocol/inspector):

```bash
npx @modelcontextprotocol/inspector --cli node src/mcp/build/index.js -e BEARER_TOKEN_BEARERAUTH=stub-guest --method tools/list
npx @modelcontextprotocol/inspector --cli node src/mcp/build/index.js -e BEARER_TOKEN_BEARERAUTH=stub-guest \
  --method tools/call --tool-name listEvents --tool-arg from=2026-10-15 to=2026-10-25
```

### Connecting it to Claude Code

[`.mcp.json`](.mcp.json) registers the server as `nearby-api` for everyone who opens the project in Claude Code, in the VS Code extension or the CLI. It starts `src/mcp/build/index.js` from the project root (Claude Code sets `CLAUDE_PROJECT_DIR` for the server) with the `stub-guest` token, so it holds no secrets. Do not put real tokens in it.

1. Run `npm run mcp:build`, then start the API with `npm run dev`.
2. Start a new conversation in Claude Code. When it asks whether to use the project's MCP servers, approve `nearby-api`.
3. Type `/mcp` in the chat panel and check that `nearby-api` shows **Connected**. From this dialog you can also reconnect or disable it.
4. Ask, for example, "Which events are in the catalog between 15 and 25 October?". The agent should call `listEvents`.

## ༄ AI Usage Note

This README was written with the participation of Claude, which drafted the initial structure and wording. The draft was reviewed and edited by Daryna Halytska and Viktoriya Baran before being committed.

**MCP Server (#95).** The "MCP Server" section, `.mcp.json`, `tools/mcp-generator/`, the `mcp:generate` and `mcp:build` scripts in `package.json` and the `exclude` in `tsconfig.json` were drafted with Claude Code. The code in `src/mcp/` is generated by openapi-mcp-generator, not by AI. Checked by Claude Code: `npm audit` (0 high), typecheck, build and the API docs workflow steps, `tools/list` in MCP Inspector (16 tools for 16 operations), `listEvents` calls compared with `curl`, and a 401 for an admin tool with `stub-guest`.

- **Agent and call:** Claude Code (VS Code extension) with `nearby-api` connected via `.mcp.json`. Asked "Які події є в каталозі між 15 і 25 жовтня?", the agent chose `listEvents` with `from=2026-10-15`, `to=2026-10-25` and listed the 2 events the stubs return (17.10 and 20.10).
- **Not as expected:** the generator drops an operation's `summary` when it has a `description`, so `cancelEvent` does not say that it cancels an event; request body fields have no descriptions; no tool states the access level it needs, so 12 of 16 tools answer 401 or 404 with the guest token; the agent treated the stub end time 23:59:59 as a likely placeholder and said so.
- **Verified by:** Daryna Halytska — ran the demo above in Claude Code.