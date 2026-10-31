# Account Creation and Sign-in

## Decision

**The code verifies the identity; password and Google are ways to sign in to it.** A verified phone number is required for every account: it is the account's identity and, unless the user turns it off, what a mutual match reveals.

## Flows

| Flow | Mechanism |
|---|---|
| Registration | Phone number + one-time code (FR-005, SEC-008), then date of birth (SAFE-001). The account stays `pending` until the age check passes; its registration token only finishes registration. Under 18, the pending account is removed. |
| Add sign-in method | Set a password and / or link a Google account |
| Sign-in | Password or Google — no message sent. A locked account gets the same answer as a wrong password. |
| Password reset | One-time code to the verified contact |

How registration, sign-in and the token check work in the code: [auth sequence diagram](../uml/rendered/sequence-diagram-auth.svg) (source: [`uml/sequence-diagram-auth.puml`](../uml/sequence-diagram-auth.puml)).

## Rules

1. **Registering via Google first** still ends with the code step — no account works without a verified contact.
2. **Google is linked only from a signed-in session**, never automatically by matching email.
3. Passwords are stored as argon2id (SEC-002); a lockout covers password sign-in and password changes (SEC-007), and codes are limited per code and per number (SEC-008).
4. Tokens are the same whichever method was used (SEC-005). A sign-in starts a **session**, one `RefreshToken` row: the access token (60 minutes) carries its id as `sid`, and the refresh token `<session id>.<secret>` (30 days, only the secret's SHA-256 is stored) renews it. Every renewal replaces the secret and extends the session; a wrong secret, such as a replaced one used again, ends the session. Every request checks the session, so sign-out, a password change (every other session), a password reset (every session) and a ban take effect at once.
5. Phone numbers and dates of birth are stored encrypted with AES-256-GCM (SEC-003); accounts and codes are found by `contact_hash`, an HMAC-SHA256 of the number. Both keys are files outside the repository, separate from the token and code keys.
6. Codes go out through one messaging adapter (FLEX-003). They are sent through the **Telegram Gateway API** as an official Telegram message to the account registered with that number, so no bot or chat ID is needed. If Telegram refuses the code or does not answer, it goes by SMS through TurboSMS. We generate and check the code ourselves, so the SEC-008 limits stay in our hands.
   **Paused for now:** paid delivery is not funded yet ([external services](../../operations/external-services.md)), so production switches codes off (`MESSAGING_PROVIDER=disabled`, the default there). Registration and password reset then answer `503 PHONE_CODES_UNAVAILABLE`; the Telegram and TurboSMS code stays and comes back by setting `MESSAGING_PROVIDER=telegram`.
7. **Organizations** are regular user accounts: they register the same way, then request organization status, and publish events only after the team has verified them (FR-003). Administrator accounts are created by the team, not through registration.

## Consequences

- New external systems: **Google** (ID token verification only) and the **Telegram Gateway API** (paid per code, with SMS as fallback).
- Data model: Account + AuthMethod (`account_id`, type `password | google`, hash or Google subject ID) and VerificationCode, which records the delivery channel and provider request ([data model](../data-model.md)).
- If the app ships to the App Store, Apple guideline 4.8 requires an equivalent privacy-focused login (in practice Sign in with Apple) — one more AuthMethod type.
- OQ-001 is resolved.

## AI Usage Note

Drafted with Claude from an architecture discussion led by Viktoriia Baran.
