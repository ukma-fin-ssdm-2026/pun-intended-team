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

## AI Usage Note