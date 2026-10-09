# Static Analysis and Security Review

Security analysis of the Nearby REST API for Lab 5: manual review, security analyzer and dependency audit.

## Manual security review

**Scope:** all hand-written server code in `src/` (API, core, stub infrastructure) plus `.mcp.json` and `.env.example`, at commit `55400b8`. Out of scope: `src/mcp/` (generated), third-party packages (see Dependency audit) and infrastructure that does not exist yet.

**Method:** the code was read along the request path (adapter → guard → `@Endpoint` → handler → exception filter) and checked against the [threat model](../architecture/threat-model.md) and the security requirements in [requirements.md](../requirements/requirements.md). Findings were confirmed with `curl` against a locally running server (`NODE_ENV=production`). Findings come from manual review; SA-01 was later also confirmed by the analyzer.

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
- **How it was found.** Manual review of the authentication path. Confirmed with `curl`: `Bearer constructor` gets `200` on `/api/v1/categories` and `/api/v1/events`, `Bearer bogus` gets `401`. User and admin endpoints still answer `401`. Confirmed by eslint-plugin-security, rule `security/detect-object-injection`.
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

**Tool:** eslint-plugin-security 4.2.0 on ESLint 10.12, run with `npm run lint`.

**Config:** `pluginSecurity.configs.recommended` in [`eslint.config.mjs`](../../eslint.config.mjs), after `tseslint.configs.recommended`. All recommended rules are on, all as warnings.

**Coverage:** all hand-written code. `eslint.config.mjs` ignores `src/mcp` (generated), `tools`, `docs` and `dist`.

**Result:** 9 warnings, 0 errors. One true positive, which confirms SA-01.

| Location | Rule | Verdict | Reason |
|---|---|---|---|
| `src/infra/stubs/sessions.repository.ts:10` | `security/detect-object-injection` | True positive | `sessions[accessToken]` uses the client's token as a key on a plain object (SA-01). |
| `src/api/common/api-exception.ts:29` | `security/detect-object-injection` | False positive | `code` is an `ErrorCode` set in code, never request input. |
| `src/api/common/auth.ts:47` | `security/detect-object-injection` | False positive | The key is the module-private `Symbol` `CALLER`. |
| `src/api/common/auth.ts:53` | `security/detect-object-injection` | False positive | Same `CALLER` symbol, read back. |
| `src/api/common/endpoint.ts:138` | `security/detect-object-injection` | False positive | `status` comes from the route definition at startup. |
| `src/api/common/endpoint.ts:154` | `security/detect-object-injection` | False positive | The key is the module-private `Symbol` `INPUT`. |
| `src/api/common/endpoint.ts:184` | `security/detect-object-injection` | False positive | Same `INPUT` symbol, written after validation. |
| `src/api/common/openapi.ts:32` | `security/detect-non-literal-fs-filename` | False positive | The path is the fixed `SPEC_FILE` in the repo; no caller passes another. |
| `src/api/common/openapi.ts:33` | `security/detect-non-literal-fs-filename` | False positive | Same `SPEC_FILE` path. |

## Dependency audit

**Setup:**

- Dependabot version updates in [`.github/dependabot.yml`](../../.github/dependabot.yml): weekly for npm in `/` and `/tools/mcp-generator`, and for GitHub Actions. `src/mcp` is excluded because it is generated.
- Dependabot alerts and security updates are enabled in the repository Settings.
- `npm audit --audit-level=high` runs for all three packages in CI via [`.github/workflows/dependency-audit.yml`](../../.github/workflows/dependency-audit.yml) (SEC-006).

**Result:** `npm audit` reports 0 vulnerabilities in all three packages, also after adding the ESLint devDependencies.

**Finding: outdated dependencies in `src/mcp`.**

- **What.** `src/mcp` uses zod 3 and dotenv 16, while current majors are newer.
- **Why it matters.** Old majors stop getting fixes. Dependabot version updates skip `src/mcp`, but vulnerabilities there are still reported by Dependabot alerts and the CI audit.
- **Decision: accepted.** `src/mcp` is generated by openapi-mcp-generator, which requires zod 3 (see [`tools/mcp-generator/package.json`](../../tools/mcp-generator/package.json)), and the README forbids editing it by hand.

## AI Usage Note

The review, the findings and the write-ups were drafted by Claude, which confirmed the findings against a locally running server with `curl`, and condensed by Claude. Verified by Daryna Halytska: checked each finding against the code; reproduced SA-01 with curl against a locally running server (NODE_ENV=production).

The analyzer and dependency audit sections were drafted by Claude (Claude Code), which ran `npm run lint` and `npm audit` on all three packages and checked each warning against the code. Verified by Daryna Halytska: ran `npm run lint` (9 warnings, as listed) and checked the Dependabot settings in the repository.