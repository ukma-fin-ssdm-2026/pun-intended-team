# Code Review Report

## 1. Strengths

- Most handlers are lightweight and only call functions from other files: get_transcript, delete_meeting, get_meeting
- Custom task priority labels are used
- errors.py: a unified format for errors
- Consistent API naming conventions
- bandit -r src: no issues

## 2. Suggestions for Improvement

- In AI notes, specify who exactly reviewed and approved the document so that, in case of a problem with this document, it’s clear who to contact
- Ruff --select D finds 98 violations: 43 classes, 34 functions, 16 modules, and 4 packages without docstrings
- ruff format --check - 10 files “need to be reformatted”
- There are minor inconsistencies in names (e.g., Boolean names).
Most have is_ / has_ (is_personal, is_current, has_api_key)
but there are also link_active, redact_speaker_names, use_builtin_model, and accept_terms (api-design.md)
- Ambiguous names in fixtures: transcribed() returns a meeting, folder_in() returns a UUID, and notes() and transcript() do not indicate that they can raise 404/409 errors.
- Some handlers contain business logic: upload_recording validates the recording itself, and list_meetings processes the filters

## 3. Potential Vulnerability / Risk

- The name filter is of type str, not DisplayText, so leading characters are allowed—meetings/schemas.py:67

---

# Bonus: AI review against ours

> **AI use:** everything from here down was produced with Claude (claude.ai, Claude Sonnet 5.5) after class, in a separate commit, as the course AI policy and the Lab 5 bonus require. The review above, written in class without AI, is unchanged and is the basis of the comparison.

**Team's repository:** Whadio, <https://github.com/ukma-fin-ssdm-2026/Whadio>
**Reviewed commit SHA:** `8dbbe90d45ea4de06b3e836cbb8fa98a94395641` (the team's last commit before the review in class on 6 October)
**Done by:** Claude (claude.ai, Claude Sonnet 5.5) reading `src/`, `pyproject.toml`, `.pre-commit-config.yaml` and `.github/workflows/ci.yml` from the repository archive, with Ruff 0.17.0 and Bandit 1.9.4 run on it, and one finding reproduced with a minimal FastAPI app that imports Whadio's own `core/errors.py` and `accounts/schemas.py`.
**Prompt:** "Review this repository as a code reviewer for a software-design course: standards and style, quality and maintainability, security (input validation, sessions, logging), use of the framework, documentation and static analysis. Give 3 strengths, 3 improvements and 1 potential vulnerability, each with file and line."

<details>
<summary>Raw AI output</summary>

## Strengths

1. **The framework is kept at the edge by a machine-checked rule.** `pyproject.toml` has six Import Linter contracts: a layer order for the backend modules, no runtime imported by a module, FastAPI/MCP/Starlette allowed only in `api`, and workers independent of the backend. Rules that are usually only a diagram are enforced on every commit. The routes are thin where the data is a stub, e.g. `get_meeting` (`api/meetings/routes.py:184`) and `get_transcript` (`:256`).
2. **One error envelope, one place that builds it.** `core/errors.py:117-130` (`_handle`) turns `ApiError`, validation errors, Starlette errors and any other exception into the same `{error: {code, message, details, request_id}}` body with an `X-Request-ID` header, and a 500 never leaks the exception text (`:156`, "Unexpected server error"). `error_responses()` (`:91`) keeps the documented codes next to each route.
3. **The tool chain is unusually strict and is the same locally and in CI.** `ruff` with `select = ["ALL"]`, `basedpyright` in recommended mode, `ty` with all rules as errors, `bandit`, `deptry`, `typos`, `zizmor`, `gitleaks` on the staged diff and on the whole history, `uv audit` for dependencies, pinned GitHub Actions by commit SHA, and Dependabot with a cooldown (`.pre-commit-config.yaml`, `.github/workflows/ci.yml`, `.github/dependabot.yml`). `bandit -c pyproject.toml -r src` reports no issues.

## Improvements

1. **Authorization is documented but not exercised anywhere.** Every meeting route takes `_user: BrowserUser` and never uses it (`api/meetings/routes.py:78, 184, 207, 236, 256, 275, 319`). The documented rules (a restricted meeting is reported as 404; deleting needs the recorder, a Moderator or the Owner, otherwise 403 `INSUFFICIENT_ROLE`) have no code path and no test. `delete_meeting` (`:236`) only calls `meeting(meeting_id)`. When the stubs are replaced, nothing will fail if a check is forgotten. *Suggestion:* pass the user into the lookups (`meeting(meeting_id, user)`), and add a test per documented 403 and 404 now, against the stub.
2. **Almost no tests.** The suite is one test, `api/test_meta.py::test_health_reports_ok`, for 16 implemented operations and four MCP tools. The API contract is checked by Redocly lint, but the behaviour documented in each route description (415 for a file that is not audio, 409 for a meeting that is not processed, the cursor check in `core/schemas.py:70-82`, the name filter) is not. *Suggestion:* a parametrised `TestClient` test per status code in `error_responses`, starting with sign-in, upload and pagination.
3. **Handlers still carry logic, and the names hide what the fixtures do.** `list_meetings` filters inline (`routes.py:80-87`) and `upload_recording` checks size, decodes the file, builds the `MeetingRead` and sets the header (`:139-171`). The fixture helpers `transcribed()` (`meetings/fixtures.py:203`) returns a meeting, `folder_in()` (`:179`) returns a UUID, and `meeting()`, `transcript()` and `notes()` raise 404 or 409 without saying so in the name. *Suggestion:* move filtering into a `meetings` function that takes a `MeetingFilter`, and rename (`require_transcribed_meeting`, `resolve_folder_id`).

## Potential vulnerability or risk

**Validation errors echo whatever the client sent, passwords included (CWE-209 / CWE-532).**

- **Where:** `core/errors.py:168` sets `provided_value=jsonable_encoder(error.get("input"))` for every validation error. The field's own description says "when it is safe to echo back" (`:46`), but no filter exists.
- **Reproduced:** `POST /api/v1/sessions` with a 141-character password, run against Whadio's own `SignIn` model and error handler, answers `422` with `details[0] = {"field": "password", "message": "String should have at most 128 characters", "provided_value": "<the whole password>"}`. A body with an extra field comes back the same way (`"provided_value": "leak-me"`).
- **Impact:** the password (or a token or recovery code in a later endpoint) is returned in a response body that browser dev tools, reverse proxies, API gateways and error trackers commonly store. It also contradicts the documented rule that a failed sign-in "never says which credential was wrong".
- **Mitigation:** echo only for an allow-list of fields (a query filter, an enum), never for `password`, `token` or `secret`, or drop `provided_value` for body fields and keep it for query and path parameters. Add a test that a too-long password is not in the response text.

**Also noted, lower severity or stub-level:**
- *The 500 MiB limit is checked after the upload has been received.* `file.size` (`routes.py:139`) is read in the handler, so Starlette has already parsed and spooled the multipart body. This is from how Starlette handles `UploadFile`; it was not reproduced. A limit has to be set at the server or proxy (`Content-Length`) as well. The file is then decoded by FFmpeg inside the API process (`meetings/audio.py:15-20`, run via `run_in_threadpool` at `routes.py:141`), which is a large attack surface for untrusted input; the design should move decoding to the worker.
- *The MCP endpoint needs no key and is not scoped to a workspace.* `app.py:77` mounts it; `mcp_server.py` reads the global `MEETINGS`. The README says personal keys are not implemented yet, so this is a known stub state; it should be a blocker for the first deployment.
- *Secrets are compared with `!=`* (`accounts/auth.py:40, 47`, `routes_sessions.py:40`). This is not exploitable with public demo tokens; the real implementation needs `hmac.compare_digest` and hashed tokens.
- *Sign-out does not end the session* (`routes_sessions.py:64`): it only clears the cookie, while the description says it "ends the session". With one static demo token this is a stub effect, but the contract is not met yet.

</details>

## Comparison of the AI review with ours

*Draft for the team to check and edit; every statement below was verified by running the tool or reading the cited line. Remarks about the in-class review are made so the team can decide what to keep.*

### Found by both

- Handlers hold logic that belongs below them (`list_meetings`, `upload_recording`).
- Ambiguous fixture names (`transcribed()`, `folder_in()`, missing 404/409 in the names).
- One consistent error format is a strength; `bandit` is clean (confirmed with `-c pyproject.toml`).

### Found only by the AI

- Validation errors echo the password and any other input (`core/errors.py:168`): **reproduced**. This is a real vulnerability and a better choice for the "1 vulnerability" point than the name filter.
- Authorization is never exercised (`_user` unused, no 403/404 test), and the whole suite is one test.
- The upload limit is checked after the body is received; FFmpeg decodes untrusted files in the API process; the MCP endpoint is unauthenticated (stub-level, noted as such).
- The strengths about Import Linter, the strict tool chain and the pinned CI actions: our review did not look at the configuration.

### Found only by us

- The naming inconsistencies of booleans: the AI confirmed `use_builtin_model` in the code, but `link_active`, `redact_speaker_names` and `accept_terms` are in `docs/api/api-design.md` for operations that are not implemented yet, so this is a remark about the design document, and the AI did not read it that closely.
- The remark that AI notes should name who reviewed them: the AI did not check the documents.

### Remarks of ours that the AI could not confirm

- **"Ruff `--select D` finds 98 violations".** With Ruff 0.17.0 the same command finds 120 (43 classes, 37 functions, 21 packages, 18 modules, 1 `__init__`), so the counts depend on the version. More important, `pyproject.toml` ignores `D` on purpose ("docstrings only where they state a contract"). The remark is accurate about the facts but is not a defect of the code by the team's own standard.
- **"`ruff format --check`: 10 files need to be reformatted".** With the repository's configuration (`line-length = 100`) all 39 files are formatted. With Ruff's default width of 88, 12 files would change. The most likely cause is running the command outside the project configuration, so this remark is a **false positive**.
- **"The name filter is `str`, not `DisplayText`" (`meetings/schemas.py:67`).** The line is right and the type is different, but `Input` strips surrounding whitespace and the field needs at least one character, and the value is only a substring match: it is never stored or shown. The impact is close to none; it is a style point, not a vulnerability.

### Remarks of the AI that we think are weak

- The timing-unsafe comparison of tokens is true of the code, but the tokens are public demo values (the repository says so, and Ruff's `S105` is switched off for that file for this reason). It becomes relevant only with real sessions.
- Sign-out and the MCP endpoint are stub-level behaviour documented in the README; they matter once the stubs go.

### What we take from it

The in-class review found the style and structure points that are visible without running anything. Running the project's own configuration, and one reproduction, found the one finding of security substance. For our own repository this suggests the same checks: run every tool with the project's configuration before writing a number in a report, and look for a place where an error response copies the request.

## AI Usage Note