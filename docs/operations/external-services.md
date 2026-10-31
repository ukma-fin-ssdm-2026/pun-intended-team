# External Services

Services the API depends on outside the repository. Amounts paid and team contributions are tracked in the team's finance sheet (Google Sheets), not here. Secret values are never written in this file or in issues.

| Service | Used for | Account owner | Payment | Price | Env variables | Status |
|---|---|---|---|---|---|---|
| Telegram Gateway API | Verification codes (FR-005) | Nearby (team number) | Prepaid balance, topped up through Fragment; at least $100 per top-up | Per delivered code; free to the owner's own number | `TELEGRAM_GATEWAY_TOKEN` | **Paused** until the app is live and funded |
| TurboSMS | SMS fallback for codes | Viktoriia Baran (FOP) | Prepaid balance | ≈ 1.3 UAH per SMS to Ukrainian numbers | `TURBOSMS_TOKEN`, `TURBOSMS_SENDER` | **Paused**: account and sender name in verification until mid-November 2026 |
| AWS Lightsail | Staging host (API, Postgres, reverse proxy) | Viktoriia Baran | Card, monthly; budget alert on the account | ≈ $12 per month (2 GB instance) | — (set on the host) | Account being confirmed |
| name.com | Domain `nearbystaging.app` | Viktoriia Baran | GitHub Student Developer Pack | Free until about October 2027, then ≈ $24 per year | — | Active |
| Google Cloud | OAuth client for Google sign-in | Viktoriia Baran | — | Free | `GOOGLE_CLIENT_IDS` | Active |

## Phone codes while paused

With `MESSAGING_PROVIDER=disabled`, the production default, no code is sent and registration and password reset answer `503 PHONE_CODES_UNAVAILABLE` ([authentication](../architecture/mechanisms/authentication.md), rule 6). To turn them back on, set `MESSAGING_PROVIDER=telegram` with a funded `TELEGRAM_GATEWAY_TOKEN`, and the TurboSMS variables for the SMS fallback.

## AI Usage Note

Drafted with Claude from the Viktoriia's notes on payments; reviewed by Viktoriia Baran.
