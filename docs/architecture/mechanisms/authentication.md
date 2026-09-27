# Account Creation and Sign-in

## Decision

**The code verifies the identity; password and Google are ways to sign in to it.** A verified phone / Telegram contact is required for every account, because that contact is what a mutual match reveals.

## Flows

| Flow | Mechanism |
|---|---|
| Registration | Phone or Telegram + one-time code (FR-005, SEC-008), then date of birth (SAFE-001) |
| Add sign-in method | Set a password and / or link a Google account |
| Sign-in | Password or Google — no message sent |
| Password reset | One-time code to the verified contact |

## Rules

1. **Registering via Google first** still ends with the code step — no account works without a verified contact.
2. **Google is linked only from a signed-in session**, never automatically by matching email.
3. Passwords are stored as argon2id (SEC-002); lockout and rate limits cover passwords and codes alike (SEC-007).
4. Tokens are the same whichever method was used (SEC-005).
5. Codes go out through one messaging adapter: Telegram first, SMS as fallback (FLEX-003).

## Consequences

- New external system: **Google** (ID token verification only).
- Data model: `users` + `auth_methods` (`user_id`, type `password | google`, hash or Google subject ID).
- If the app ships to the App Store, Apple guideline 4.8 requires an equivalent privacy-focused login (in practice Sign in with Apple) — one more `auth_methods` type.
- OQ-001 is resolved.

## AI Usage Note

Drafted with Claude from an architecture discussion led by Viktoriia Baran.
