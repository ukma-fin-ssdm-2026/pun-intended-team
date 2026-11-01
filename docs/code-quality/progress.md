<!-- Written with the help of Claude -->
# Prototype Progress

Owner: Oleh Moshenskyi (Prototype Lead).

## 1. Where the prototype stands

State on 1 November 2026. The API runs on PostgreSQL for accounts, sessions, categories, profiles and interests; events and listings are still served from in-memory stubs, so changes to them last until the server restarts. The API and the web app run on [staging](https://nearbystaging.app).

| Part | State | Issue |
|---|---|---|
| Event catalog: browse, get, publish, replace, cancel | Working, in memory | #142 |
| Event import from the Concert.ua sample feed | Working, in memory | #211 |
| Listings: browse, get, post, remove | Working, in memory | — |
| Categories and administration of categories | Working, PostgreSQL | #144 |
| Profiles: onboarding, edit, interests, linked accounts | Working, PostgreSQL | #141, #337 |
| Sign-in with Google, JWT access tokens, refresh sessions | Working, PostgreSQL; phone and password routes paused by [ADR-004](../architecture/decisions/ADR-004.md) | #140, #212, #325 |
| Events and listings in PostgreSQL | In progress | #310 |
| Matching | The `match` algorithm and the interest score; no endpoints yet | #285 |
| Expo client | Google sign-in and the profile screens use the API; the catalog, map, matches and listings show test data | #143, #337 |
| Staging | API and web app on one server | #313, #332 |
| Notifications, reports and bans, statistics | Not started | — |

28 operations are implemented and documented in [`openapi-generated.yaml`](../api/openapi-generated.yaml) (auth 6, events 5, listings 4, categories 1, admin categories 5, profiles 5, interests 1, health 1). The `src/mcp/` server exposes all of them as tools except the auth operations.

Sections 2 to 5 describe the first working component, the profile, as it was delivered in Lab 5.

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

The profiles module follows the listings pattern: `ProfilesApiModule` (controller and schemas) imports `ProfilesModule` (service), which depends on the abstract `ProfilesRepository` and `InterestsRepository`. The date of birth comes from `AccountsService` in the `identity` module, because lint forbids one module from importing another module's repository. `InfraModule` binds the new `ProfilesRepository` and `InterestsRepository` to stubs; the existing `AccountsRepository` got one new method, `findDateOfBirth`. Swapping in a database means writing these classes in `infra/` and changing their lines in `InfraModule`; the services, the controller and the tests stay.

## 3. First working component: the profile

New Gallery (`+380501110004`) has no profile yet, so it can start onboarding. With the keys generated (`npm run keys:generate`) and the API running (`npm run dev`):

```bash
H='Content-Type: application/json'; U=http://localhost:4100
T=$(curl -s -X POST $U/api/v1/auth/sign-in -H "$H" \
     -d '{"phone":"+380501110004","password":"nearby-dev-password"}' \
     | node -pe 'JSON.parse(require("fs").readFileSync(0)).accessToken')
A="Authorization: Bearer $T"

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
| Disclosure | Each new file starts with the AI note required by the charter (§9) |

## 5. Verification run

Run on the code of this pull request:

| Check | Result |
|---|---|
| `npm run test:e2e` | 98 of 98 pass, 23 of them for profiles and interests; the 2 old `PATCH /events` tests were replaced by the `PUT` tests |
| `npm run lint`, `npm run format:check`, `npm run typecheck` | pass |
| `npm audit --package-lock-only --audit-level=high` | 0 vulnerabilities |
| `eslint-plugin-security` (recommended rules, part of `npm run lint`) | 0 errors, 14 warnings on `src/` and `tests/`: `detect-object-injection`, `detect-non-literal-fs-filename` and `detect-non-literal-regexp`. See the [static analysis](static-analysis.md) report for how they were judged |

The SA-01 finding (#129) concerned the stub `sessions[accessToken]` lookup, which answered `200` to the "tokens" `constructor`, `__proto__` and `toString`. Sign-in with signed JWT tokens (#140) removed that lookup, and the e2e test "rejects a token named like an object property with 401" covers it. Every profile endpoint needs an account token and answers `401` to such values.

## 6. Known gaps and next steps

- **Events and listings in PostgreSQL (#310):** they are the last parts on stubs; the Prisma models are already in the schema.
- **Matching:** the `match` algorithm needs its endpoints, the matching rounds and the contact reveal.
- **Expo client:** the catalog, map, matches and listings screens move from test data to the API.
- **Not started:** notifications, reports and bans, and platform statistics.
- [`quality-attributes.md`](../api/quality-attributes.md) still records the Lab 4 Swagger UI checks of `PATCH /events/{id}`; they are history of that lab and were left unchanged.

## AI Usage Note

The profiles module, the `PUT /events/{id}` changes, the end-to-end tests, and this document were developed with assistance from Claude, reviewed by Oleh, and independently verified.
