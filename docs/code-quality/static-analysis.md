# Static Analysis and Security Review

Security analysis of the Nearby REST API for Lab 5. The analyzer results and the dependency audit are added in separate changes.

## Manual security review

**Scope:** all hand-written server code in `src/` (API, core, stub infrastructure) plus `.mcp.json` and `.env.example`, at commit `55400b8`. Out of scope: `src/mcp/` (generated), third-party packages (see Dependency audit) and infrastructure that does not exist yet.

**Method:** the code was read along the request path (adapter → guard → `@Endpoint` → handler → exception filter) and checked against the [threat model](../architecture/threat-model.md) and the security requirements in [requirements.md](../requirements/requirements.md). Findings were confirmed with `curl` against a locally running server (`NODE_ENV=production`). No rule IDs apply: all findings come from manual review.

### Findings

| ID | Location | Finding | Risk | Related | Decision |
|---|---|---|---|---|---|
| SA-01 | `src/infra/stubs/sessions.repository.ts`, `src/api/common/auth.ts` | Tokens such as `constructor` or `toString` are accepted as guest tokens. | Medium | TM-11, SEC-005 | To be fixed in #129 |
| SA-02 | `src/api/common/config.ts` | Swagger UI and the spec rewrite are on unless `NODE_ENV` is exactly `production` (fail-open). | Medium | TM-11, SEC-006 | Accepted |
| SA-03 | `src/infra/stubs/data.ts`, `.mcp.json` | Fixed demo tokens, including `stub-admin`, are committed and published in the docs. | High if deployed | TM-11, SEC-005 | Accepted for the stub phase: real authentication is required before the first deployment |
| SA-04 | `src/api/main.ts` | No rate limiting: 150 requests in a row all returned `200`. | Medium | TM-10, SEC-007 | Open, planned before deployment |
| SA-05 | `src/api/main.ts` | No security response headers (`nosniff`, `Cache-Control`, CSP, HSTS). | Low | SEC-001, SEC-006 | Open, planned with SA-04 |

### SA-01: inherited object properties accepted as access tokens

- **What was found.** The stub repository looks tokens up with `sessions[accessToken]` on a plain object, so names inherited from `Object.prototype` (`constructor`, `__proto__`, `toString`, `hasOwnProperty`) return a value instead of `undefined`. `AuthGuard` treats any caller that is not an account as a guest, so these tokens pass every guest endpoint.
- **How it was found.** Manual review of the authentication path. Confirmed with `curl`: `Bearer constructor` gets `200` on `/api/v1/categories` and `/api/v1/events`, `Bearer bogus` gets `401`. User and admin endpoints still answer `401`.
- **Why it is a risk.** SEC-005 requires every invalid token to be rejected with `401`, and TM-11 relies on deny-by-default guards. The impact today is small, since the guest tier only reads the catalog, but the same pattern in real session handling, or a new caller kind, would slip through.
- **Decision: to be fixed in #129.** Look tokens up with `Object.hasOwn` or a `Map`, accept a guest only when `caller.kind === 'guest'`, and add a regression test that `Bearer constructor` gets `401`.

### SA-02: Swagger UI enabled unless `NODE_ENV=production`

- **What was found.** `isProduction` is true only for the exact value `production`. With `NODE_ENV` unset or misspelled, the server serves Swagger UI with "Try it out" at `/api-docs` and rewrites `docs/api/openapi-generated.yaml` on start. `SWAGGER_UI=false` cannot turn Swagger off.
- **How it was found.** Manual review of `config.ts` and `main.ts`. Confirmed that with `NODE_ENV=production` `/api-docs` answers `404`.
- **Why it is a risk.** A deployment that forgets one variable exposes an interactive console against the live API. Safe behaviour that depends on a variable being set exactly right is a fail-open default.
- **Decision: accepted.** `NODE_ENV=production` is a mandatory part of every deployment configuration. Locally the team relies on Swagger and the spec refresh, and the spec is already public on GitHub Pages. Revisit if a deployment is found running without it.

### What is done well

- **Deny by default:** the guard is global, and an endpoint without an access level requires a signed-in user.
- **No disclosure:** `403` and other users' resources answer `404`, as if they did not exist.
- **Validated input and shaped output:** every endpoint validates params, query and body with zod (unknown fields are rejected), and every response is parsed by its schema, which drops internal fields.
- **No leaked internals (INTC-004):** clients get fixed error messages, never stack traces; body limit 100 kB, `x-powered-by` disabled, CORS off.

## Security analyzer (eslint-plugin-security)

Results will be added once ESLint is set up in the project.

## Dependency audit

Added in a separate PR (#128, issue #127).

## AI Usage Note

The review, the findings and the write-ups were drafted by Claude, which confirmed the findings against a locally running server with `curl`, and condensed by Claude. Verified by Daryna Halytska: checked each finding against the code; reproduced SA-01 with curl against a locally running server (NODE_ENV=production).