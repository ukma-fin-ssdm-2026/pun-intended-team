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

> **AI use:** The raw AI review below was produced with Claude (claude.ai, Claude Sonnet 5.5) after class. The comparison was initially drafted with Claude and edited below after checking the supplied repository archive. The in-class review above was written without AI and is preserved unchanged as the comparison baseline.

**Team's repository:** Whadio, <https://github.com/ukma-fin-ssdm-2026/Whadio>
**Reviewed commit SHA:** the in-class review: `8dbbe90d45ea4de06b3e836cbb8fa98a94395641` (5 October). The AI review: `16def36e54ed99c27a183d19a4dcf0472c654c0b`, Whadio's `main` when the AI review was made on 10 October. Earlier versions of this report gave `8dbbe90` for both; the AI's line references, its `_user` parameter names, the tooling it describes and `test_meta.py` exist only from `16def36`, as the Whadio history shows.
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

## Comparison of the AI review with the in-class review

Sections 1–3 above are the team's original in-class review and remain unchanged. The comparison below uses that review as its baseline.

The two reviews looked at different commits, five days apart. Between them Whadio moved the package to `src/whadio/`, renamed the unused `user` parameters to `_user`, added type annotations, moved the spec export's entry point into a CLI, and added its tooling and its first test; the behaviour of the API did not change. Points about the code therefore compare directly, while points about tooling and tests describe two different states of the repository.

### Findings raised by both reviews

- Some API handlers contain logic that could live below the HTTP layer: `list_meetings` applies filters inline, and `upload_recording` checks and decodes the uploaded file and builds the response.
- Some fixture names do not make their behavior clear: `transcribed()` returns a meeting, `folder_in()` returns a UUID, and `transcript()` can raise errors through `transcribed()`.
- Both reviews noted the shared error response format and that Bandit reported no findings in the recorded run. A clean Bandit result does not establish that the application has no security issues.

### Findings raised by the AI review only

- **Validation responses include invalid input values.** In the supplied source, `src/whadio/api/core/errors.py:159-168` places the rejected input in `provided_value`, except for missing fields. `SignIn.password` is limited to 128 characters (`src/whadio/api/accounts/schemas.py:48-57`). The raw Claude review says it reproduced a too-long password being echoed in an error response. A later check reran it and found that only a value that fails its own validation is echoed; see [Where the AI review was wrong](#where-the-ai-review-was-wrong). The risk is that a response containing a secret may be retained by browser tooling, a proxy, or an error tracker; the report does not establish disclosure to a different user. The finding is best described as sensitive-input reflection with downstream exposure risk.
- **Meeting-level authorization is not implemented.** Meeting handlers receive a `BrowserUser` dependency, which checks the fixed demo cookie, but they do not use the caller for workspace or role checks. The concern is missing resource-level authorization, not that the routes have no authentication dependency at all.
- **Behavioral test coverage is very small.** The supplied archive contains `src/whadio/api/test_meta.py` with one health-check test. The broader API behavior is not covered by tests in this snapshot.
- **Upload and MCP hardening risks:** the upload-size check is in the handler after FastAPI/Starlette has parsed the multipart upload; audio decoding runs in the API process. The README also says the stub MCP endpoint has no key. These are valid risks to review before deployment, though the MCP behavior is explicitly described as a stub and the upload impact was not reproduced in the raw review.

### Findings raised by the team only

- The boolean-name examples are partly in the implementation and partly in `docs/api/api-design.md`. `use_builtin_model` exists in the API schema; `link_active`, `redact_speaker_names` and `accept_terms` appear in the design document for operations not implemented in the supplied code. This is a consistency observation about the design, not a lint violation in the implementation.
- The suggestion to identify who reviewed AI-generated notes is a documentation/process point. The raw AI review did not inspect that policy or the relevant documents.

### Accuracy notes on the original review

- **At the in-class commit there were no tests and no static-analysis configuration.** An earlier version of these notes said the archive had one test and configured Ruff, type checks and Bandit; that described `16def36`. At `8dbbe90` there is no test and no `.pre-commit-config.yaml`, and CI runs only the Redocly lint and the spec drift check.
- **“Custom task priority labels are used” cannot be checked from this ZIP.** GitHub issue labels are not part of the source archive. Keep this point only if it was confirmed directly on the team's issue tracker.
- **The Ruff counts are confirmed.** Rerun at `8dbbe90` with Ruff 0.17.2 and no project configuration, since the commit has none: `ruff check --select D src` finds 98 (43 classes, 34 functions, 16 modules, 4 packages and one `__init__`), and `ruff format --check src` would reformat 10 files, as the in-class review says. The `D` ignore and the `line-length = 100` that earlier notes cited were added three days later.
- **The `name: str` observation is a validation/style concern, not a demonstrated vulnerability.** The field has length bounds, input strings are stripped by the shared `Input` model, and the value is used only as a case-insensitive substring filter. It is not stored or returned.

### Where the AI review was wrong

Every remark of the raw review was checked against `16def36`, the commit it reviewed: the line references and the tool configuration by reading the code, Bandit 1.9.4 rerun on `src/` (no issues, as the review says), and the vulnerability reproduced with FastAPI 0.162 and Pydantic 2.14 against Whadio's own `core/errors.py` and `accounts/schemas.py`. The line references, the tooling, the test and operation counts and the authorization finding all hold. Four remarks do not:

1. **The vulnerability's impact is overstated ("passwords included").** Only a value that fails its own validation is echoed. A 141-character password comes back in `provided_value`, but a password of 1 to 128 characters never does, even when another field of the same request is invalid: a request with a malformed email and such a password returns no password. A user's real password is therefore not reflected by an ordinary failed sign-in; what can come back is an over-long value pasted by mistake, an unknown extra field, or a later secret field with a format rule. The finding itself is real, and Whadio removed the echo on 12 October (`e1c44fe`), but it is less severe than the review says.
2. **The echo does not break the rule that a failed sign-in "never says which credential was wrong".** The `422` comes from request validation, before any credential is compared (`accounts/routes_sessions.py:40`), and it repeats only what the client sent. It says nothing about whether the email or the password is wrong, so the rule for `401 INVALID_CREDENTIALS` still holds.
3. **`pyproject.toml` declares seven Import Linter contracts, not six.** The four the review describes exist; it leaves out that the runtimes are independent of each other, that the job contracts and shared code import no other Whadio package, and that only processing and the workers use the job contracts. The strength stands; the count is wrong.
4. **`notes()` does not raise `409`.** The review groups `meeting()`, `transcript()` and `notes()` as raising 404 or 409. `notes()` raises only the `404` of `meeting()` and returns an empty list for a meeting that is not processed (`meetings/fixtures.py:215-217`). The naming point holds for `meeting()` and `transcript()`.

The stub-level side notes (the MCP endpoint without a key, secrets compared with `!=`, a sign-out that only clears the cookie) are correct, and the review itself labels them as stub effects, so they are not counted as wrong. The upload-size point describes how Starlette handles `UploadFile`; neither the review nor this check reproduced it.

### What we take from the comparison

The in-class review identified visible style and structure concerns. The AI review added useful checks for request validation, access control, test coverage and upload handling. The follow-up also shows why review claims should distinguish a configured project standard from an optional stricter check, and why exact tool output and the reviewed commit should be recorded: here the two reviews looked at commits five days apart, and the earlier notes judged the in-class review against the later one. Checked against the code, most of the AI's remarks hold; where it was wrong, it overstated the impact of a real finding and miscounted, rather than inventing a problem.

## AI Usage Note

Sections 1–3 were written by the team during the in-class review without AI and are preserved unchanged. The raw bonus review was produced with Claude, as identified above. Checked by Oleh. The commit correction and the part on where the AI review was wrong were drafted with Claude (Claude Code), which checked each remark against the Whadio history and reran the tools and the reproduction; reviewed by Oleh.
