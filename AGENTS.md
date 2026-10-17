# Agent Notes

Notes for AI agents working in this repository. Team rules are in [`TeamCharter.md`](TeamCharter.md); this file covers what an agent needs day to day.

## Project

Nearby is a NestJS REST API (Node.js 26, see [`.nvmrc`](.nvmrc)) for a mobile app about going to events with new people. The product is described in [`Project-Description.md`](Project-Description.md), the API in [`docs/api/api-design.md`](docs/api/api-design.md).

- `src/api/` — HTTP layer; `src/core/` — business logic, one folder per module; `src/infra/` — database and external services. See [Code Structure](docs/architecture/mechanisms/code-structure.md).
- Data comes from stubs in `src/infra/stubs/`; there is no database yet. Matching and notifications are designed but not implemented.
- `tests/e2e/` — end-to-end tests.
- `src/mcp/` and `docs/api/openapi-generated.yaml` are generated; never edit them by hand.

Code, comments, commits and docs are in English.

## Code

- Every TypeScript file Claude writes or co-writes starts with `// Written with the help of Claude`; so does `tsconfig.json`. Other JSON files and generated files do not get it.
- Config and workflow files that AI generated start with an `AI Usage Note` comment block instead: what was generated, how it was verified, and who reviewed it. Markdown documents get an `AI Usage Note` section at the end (charter §9).
- Keep AI Usage Notes short and general: no issue numbers, line references or change details. Leave existing notes as they are.
- Comments only where the code would mislead without them.
- Never commit `.env` or real tokens; new variables go to `.env.example` with a safe default.

## Checks

Run these before committing. CI runs the e2e tests, the spec check and the dependency audit; its `CI passed` job must be green to merge.

```bash
npm run typecheck
npm run lint
npm run format:check
npm run test:e2e
npm run docs:generate   # after any API change; commit the updated spec, CI fails on a stale one
```

## Git

- Enable the commit hooks once per clone: `git config core.hooksPath .githooks`, and install [pre-commit](README.md#commit-hooks) with `pipx install pre-commit`. Every commit then runs gitleaks, Prettier and ESLint on the staged files. Never bypass it with `--no-verify`.
  If Prettier changes a file, the commit stops: review the change, `git add` it and commit again. A gitleaks finding is fixed by removing the secret, not by adding it to `.gitleaksignore`, unless the team agrees it is a false positive.
- Work on the branch you are on. Do not create or switch branches unless asked; new branches are `feature/<issue-number>-<short-description>`, created from `main`.
- Never commit or push to `main`; it only changes through pull requests.
- Commit and push only when asked. Never force-push, rebase or amend commits that are already pushed.
- One logical change per commit. Subject: `(#<issue>) <Imperative subject>`, capitalised, no trailing period, at most 72 characters, e.g. `(#140) Add JWT sign-in`.
- Mark AI use in every commit it touched with a `Co-Authored-By:` trailer for the model.

## Pull Requests and Issues

- Before opening a pull request, merge `main` into the branch and run the checks above.
- The description links the issue (`Closes #<issue>`) and says what changed and how it was checked.
- A pull request needs one approval from another member; for a subtask, from the person responsible for the parent task. Agents do not approve or merge pull requests.
- Every review comment must be addressed before the pull request is merged.
- Do not create, close or relabel issues without asking; labels are listed in charter §4.

## Architectural Mechanisms

Before changing code in one of these areas, read its mechanism in [`docs/architecture/mechanisms/`](docs/architecture/mechanisms/) and follow it. If a change cannot follow it, say so instead of working around it.

| Area | Mechanism |
|---|---|
| Layers and folders: `src/api/`, `src/core/`, `src/infra/` | [`code-structure.md`](docs/architecture/mechanisms/code-structure.md) |
| Registration, sign-in and tokens | [`authentication.md`](docs/architecture/mechanisms/authentication.md) |
| Catalog endpoints, guest tokens and rate limits | [`catalog-access.md`](docs/architecture/mechanisms/catalog-access.md) |
| Database roles and migrations | [`database-access.md`](docs/architecture/mechanisms/database-access.md) |
| Applications, matching rounds and proposals | [`matching.md`](docs/architecture/mechanisms/matching.md) |
| Inbox and push notifications | [`notifications.md`](docs/architecture/mechanisms/notifications.md) |
| Tests and coverage: `tests/`, `mcr.config.mjs` | [`testing.md`](docs/architecture/mechanisms/testing.md) |

## MCP Server

[`src/mcp/`](src/mcp/) is an [MCP](https://modelcontextprotocol.io/) server that exposes the API endpoints as tools. Endpoints declared with `mcp: false` in `@Endpoint` are left out: the auth endpoints, since an agent cannot use a token it gets back and `register` sends a code. It is generated from [`openapi-generated.yaml`](docs/api/openapi-generated.yaml) by [openapi-mcp-generator](https://github.com/harsha-iiiv/openapi-mcp-generator), pinned in [`tools/mcp-generator/`](tools/mcp-generator/). Tool names are the `operationId`s; descriptions and parameter docs come from the spec.

Do not edit `src/mcp/` by hand. If an agent misreads a tool, fix the `summary`, `description` or `.describe()` in [`src/api/`](src/api/), then regenerate the spec and the server:

```bash
npm run docs:generate   # spec from the zod schemas
npm run mcp:generate    # src/mcp/ from the committed spec
npm run mcp:build       # installs src/mcp/ dependencies and compiles to src/mcp/build/
```

`src/mcp/` is a separate Node project with its own `package.json` and lock file, and is excluded from the API's `tsconfig.json`. Each regeneration also changes the `Generated on` timestamp in `src/mcp/src/index.ts`.

### Running it

Start the API first with `npm run dev`. The MCP server talks over stdio and forwards each tool call to the API. Start it through [`tools/mcp-start.mjs`](tools/mcp-start.mjs), which gets a guest token from the API and renews it before it expires:

```bash
node tools/mcp-start.mjs
```

Start it with `node`, not `npm start`: npm prints its own lines to stdout, which breaks the stdio protocol, and rebuilds on every start.

| Variable | Default | Meaning |
|---|---|---|
| `BEARER_TOKEN_BEARERAUTH` | a guest token | Sent as `Authorization: Bearer …` on every call. Unset, the launcher uses a guest token, enough for catalog reads. For other tools, pass a token from `/api/v1/auth/sign-in` with the right role ([Trying It Out](docs/api/api-design.md#trying-it-out)); it expires after 60 minutes and is not renewed |
| `API_BASE_URL` | `http://localhost:4100` | API the tools call; the default comes from `servers` in the spec |

Pass tokens as environment variables, never in a committed file.

To list the tools and call one without an agent, use the [MCP Inspector](https://github.com/modelcontextprotocol/inspector):

```bash
npx @modelcontextprotocol/inspector --cli node tools/mcp-start.mjs --method tools/list
npx @modelcontextprotocol/inspector --cli node tools/mcp-start.mjs \
  --method tools/call --tool-name listEvents --tool-arg from=2026-10-15 to=2026-10-25
```

### Connecting it to Claude Code

[`.mcp.json`](.mcp.json) registers the server as `nearby-api` for everyone who opens the project in Claude Code, in the VS Code extension or the CLI. It starts `tools/mcp-start.mjs` from the project root (Claude Code sets `CLAUDE_PROJECT_DIR` for the server), which gets a guest token from the running API, so the file holds no secrets. Do not put real tokens in it.

1. Run `npm run mcp:build`, then start the API with `npm run dev`.
2. Start a new conversation in Claude Code. When it asks whether to use the project's MCP servers, approve `nearby-api`.
3. Type `/mcp` in the chat panel and check that `nearby-api` shows **Connected**. From this dialog you can also reconnect or disable it.
4. Ask, for example, "Which events are in the catalog between 15 and 25 October?". The agent should call `listEvents`.

## AI Usage Note

This file was drafted with Claude Code and reviewed and edited by the team.
