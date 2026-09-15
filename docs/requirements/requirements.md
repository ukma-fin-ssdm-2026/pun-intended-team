# System Requirements

## 1. Purpose and Scope
Briefly: what this product is, who it's for, what is out of scope for this version.

## 2. Glossary
- Term A – definition
- Term B – definition

## 3. Functional Requirements (FR)
- FR-001: ...
- FR-002: ...

## 4. Non-Functional Requirements (NFR)
- PORT-001 (Portability): The application must share at least 90% of its codebase across iOS, Android, and Web platforms, without requiring platform-specific code.
- SEC-001 (Security): User contact details (such as phone number, links, etc.) are revealed to the other participant only after a successful match. Attempting to access information marked as hidden without the match results in blocking in 100% of test cases (HTTP 403). Data transmission also occurs over a channel encrypted with TLS 1.2+.
- USA-001 (Usability): A new user must understand the app's purpose and how to join an event within the first 30 seconds.

## 5. Assumptions and Constraints
- A-001: ...
- C-001: ...

## 6. Risks and Open Questions
- R-001: ...
- OQ-001: ...