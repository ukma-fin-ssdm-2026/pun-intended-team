<!-- Written with the help of Claude -->
# Prototype Progress (Lab 5)

Owner: Oleh Moshenskyi (Prototype Lead). This file describes what the code can do today, how to try it, and what is left before the minimal working prototype of Lab 6.

## 1. Where the prototype stands

The Nearby API runs end to end on stub data: a request goes through validation, the access check, a service in `core/` and a stub repository in `infra/`, and comes back as a documented response. Nothing is stored in a database yet; changes last until the server restarts.

| Part | State | Issue |
|---|---|---|
| Event catalog: browse, get, publish, **replace**, cancel | Working | #142 |
| Listings: browse, get, post, remove | Working | — |
| Categories and administration of categories | Working | — |
| **Profiles: onboarding in steps, edit, interests, `isComplete`** | **Working (first component of this lab)** | #141 |
| Sign-in with JWT access tokens | Stub tokens only | #140 |
| Local PostgreSQL with Prisma | Not started | #144 |
| Expo client | Not started | #143 |

21 operations are implemented and documented in [`openapi-generated.yaml`](../api/openapi-generated.yaml) (events 5, listings 4, categories 1, admin categories 5, profiles 4, interests 1, health 1). The `src/mcp/` server was regenerated and exposes all of them as tools.

## 2. Code structure

Three layers, as in [code-structure](../architecture/mechanisms/code-structure.md). A dependency points only downwards, and `core/` knows nothing about HTTP or storage.

```
src/
├── api/                    HTTP: routes, zod schemas, access check, error format
│   ├── common/             @Endpoint, auth guard, routes, error filter
│   ├── catalog/            events, categories, admin categories
│   ├── listings/
│   └── profiles/           NEW  controllers/profiles.controller.ts, schemas/profiles.ts
├── core/                   business rules; depends on abstract repositories only
│   ├── catalog/  listings/  identity/
│   └── profiles/           services/profiles.service.ts, repositories/*.ts (abstract), types/profile.ts
└── infra/stubs/            in-memory implementations; replaced by Prisma repositories in #144
```

The profiles module follows the listings pattern: `ProfilesApiModule` (controller and schemas) imports `ProfilesModule` (service), which depends on the abstract `ProfilesRepository`, `InterestsRepository` and `AccountsRepository`. `InfraModule` binds them to the stubs. Swapping in a database means writing three classes in `infra/` and changing three lines in `InfraModule`; the service, the controller and the tests stay.

## 3. First working component: the profile

`stub-new-user` is an account that has not started onboarding. With the API running (`npm run dev`):

```bash
H='Content-Type: application/json'; A='Authorization: Bearer stub-new-user'; U=http://localhost:4100

curl -s $U/api/v1/interests -H "$A"                                    # ids to pick from
curl -si -X POST  $U/api/v1/me/profile -H "$A" -H "$H" \
     -d '{"username":"my_name","displayName":"Me"}'                    # 201, Location: /api/v1/me/profile, isComplete=false
curl -s  -X PATCH $U/api/v1/me/profile -H "$A" -H "$H" \
     -d '{"communicationFormat":"friends","description":"Films and walks"}'
curl -s  -X PUT   $U/api/v1/me/profile/interests -H "$A" -H "$H" \
     -d '{"interestIds":["b1d2c3e4-5f60-4a71-8b82-1a2b3c4d5e01"]}'     # isComplete=true now
curl -s  $U/api/v1/me/profile -H "$A"                                  # with the age computed from the account's date of birth
```

Rules implemented and covered by e2e tests: `409 USERNAME_TAKEN` (case-insensitive, also on edit), `409 PROFILE_EXISTS`, `404` on `GET`/`PATCH`/interests before the profile exists, `422 REFERENCE_NOT_FOUND` for an unknown interest (nothing changes), a repeated interest id counts once, `isComplete` needs a communication format **and** one interest, the date of birth and the account id are never returned.

The events rules of #142 ride on the same layers: `PUT /events/{id}` replaces the editable fields with the body of `POST`, answers `404` to anyone but the posting organization, `422 EVENT_CANCELLED` for a cancelled event, and `400` with one `details` entry per invalid field.

## 4. Quality standards applied

| Standard | How it is applied here |
|---|---|
| Naming | Handlers are verbs (`createMyProfile`, `replaceMyInterests`); the `operationId` is the same name, so it is also the MCP tool name. Booleans read as questions: `isComplete`, `sharePhone` |
| Formatting | Prettier (`singleQuote`, `printWidth: 120`): `npm run format:check` passes |
| Lint and types | `npm run lint` and `npm run typecheck` (TypeScript `strict`) pass |
| Input validation | Every body is a `z.strictObject`: unknown fields are a `400`; the username has a pattern that must start with a letter or digit, lengths are bounded |
| Layering | Controllers only translate HTTP; rules live in `core/profiles/services/profiles.service.ts`, which raises `DomainError` codes the API layer maps to statuses |
| Documentation | The spec is generated from the same zod schemas; [`api-design.md`](../api/api-design.md) describes the new resources, endpoints and error codes |
| Disclosure | Each new file starts with the AI note required by the charter (§8) |

## 5. Verification run

Run on the code of this pull request:

| Check | Result |
|---|---|
| `npm run test:e2e` | 71 of 71 pass (35 before; the 2 `PATCH /events` tests were replaced and 38 added) |
| `npm run lint`, `npm run format:check`, `npm run typecheck` | pass |
| `npm audit --package-lock-only --audit-level=high` | 0 vulnerabilities |
| `eslint-plugin-security` (recommended rules, run by hand, not yet in CI) | 0 errors, 9 warnings on `src/`: 7 × `detect-object-injection` and 2 × `detect-non-literal-fs-filename`. See the [static analysis](static-analysis.md) report for how they were judged |

While testing the stubs the Prototype Lead confirmed the SA-01 finding (#129): a guest endpoint such as `GET /api/v1/categories` answers `200` to the "tokens" `constructor`, `__proto__` and `toString`, because `sessions[accessToken]` reads the object's prototype. Endpoints that need an account (every profile endpoint included) answer `401`, because such a value has no `kind: 'account'`. The new `AccountsRepository` stub avoids the same pattern.

## 6. Known gaps and next steps

- **Sign-in (#140)** replaces the stub tokens; the guard in `api/common/auth.ts` and the `AuthService` already isolate the lookup.
- **Database (#144)**: the three new repositories need Prisma implementations. The unique index on `lower(username)` must produce the same `USERNAME_TAKEN`; the service check is only a fast path, as with category names.
- **`sharePhone: false`** is accepted although the data model requires one shared contact; the rule needs linked accounts, which are out of scope for #141.
- **Out of scope for #141:** photo upload and linked accounts.
- [`quality-attributes.md`](../api/quality-attributes.md) still records the Lab 4 Swagger UI checks of `PATCH /events/{id}`; they are history of that lab and were left unchanged.
- The end-to-end tests were run with Node 22 while preparing this change; CI uses Node 26 (`.nvmrc`) and is the reference run.

## AI Usage Note

The profiles module, the `PUT /events/{id}` change, the e2e tests and this file were written with Claude and then run, not only read: typecheck, lint, Prettier, `npm run test:e2e`, `npm run docs:generate`, `npm run mcp:generate`, and the curl check of SA-01 above. To be reviewed by: Viktoriya Baran (Backend Lead) before merge.
