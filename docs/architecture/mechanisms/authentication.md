# Account Creation and Sign-in

## Decision

**The code verifies the identity; password and Google are ways to sign in to it.** A verified phone number is required for every account: it is the account's identity and, unless the user turns it off, what a mutual match reveals.

## Flows

| Flow | Mechanism |
|---|---|
| Registration | Phone number + one-time code (FR-005, SEC-008), then date of birth (SAFE-001). The account stays `pending` until the age check passes. |
| Add sign-in method | Set a password and / or link a Google account |
| Sign-in | Password or Google — no message sent |
| Password reset | One-time code to the verified contact |

How registration, sign-in and the token check work in the code: [auth sequence diagram](../uml/rendered/sequence-diagram-auth.svg) (source: [`uml/sequence-diagram-auth.puml`](../uml/sequence-diagram-auth.puml)).

## Rules

1. **Registering via Google first** still ends with the code step — no account works without a verified contact.
2. **Google is linked only from a signed-in session**, never automatically by matching email.
3. Passwords are stored as argon2id (SEC-002); lockout and rate limits cover passwords and codes alike (SEC-007).
4. Tokens are the same whichever method was used (SEC-005).
5. Codes go out through one messaging adapter (FLEX-003). They are sent through the **Telegram Gateway API** as an official Telegram message to the account registered with that number, so no bot or chat ID is needed. If the number has no Telegram account or delivery fails, the code goes by SMS. We generate and check the code ourselves, so the SEC-008 limits stay in our hands.
6. **Organizations** are regular user accounts: they register the same way, then request organization status, and publish events only after the team has verified them (FR-003). Administrator accounts are created by the team, not through registration.

## Consequences

- New external systems: **Google** (ID token verification only) and the **Telegram Gateway API** (paid per code, with SMS as fallback).
- Data model: Account + AuthMethod (`account_id`, type `password | google`, hash or Google subject ID) and VerificationCode, which records the delivery channel and provider request ([data model](../data-model.md)).
- If the app ships to the App Store, Apple guideline 4.8 requires an equivalent privacy-focused login (in practice Sign in with Apple) — one more AuthMethod type.
- OQ-001 is resolved.

## AI Usage Note

Drafted with Claude from an architecture discussion led by Viktoriia Baran.
